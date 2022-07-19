import {Op} from "sequelize";
import BigNumber from "bignumber.js";
import {EventData} from "web3-eth-contract";
import {TokenPriceProvider} from "../providers/types";
import {sendFirstWqtJob} from "../../jobs/sendFirstWqt";
import {IController, ILogger, SwapUsdtEvents} from "./types";
import {IContractProvider, IContractListenerProvider} from "../../../types";
import {
  CommissionTitle,
  BlockchainNetworks,
  TransactionStatus,
  CommissionSettings,
  BridgeSwapUsdtTokenEvent,
  FirstWqtTransmissionData,
  TransmissionStatusFirstWqt,
  BridgeSwapUsdtParserBlockInfo,
} from "@workquest/database-models/lib/models";

export class BridgeUsdtController implements IController {
  constructor(
    protected readonly Logger: ILogger,
    public readonly network: BlockchainNetworks,
    public readonly contractProvider: IContractProvider,
    protected readonly tokenPriceProvider: TokenPriceProvider,
  ) {
  }

  public async getLastCollectedBlock(): Promise<number> {
    const [{ lastParsedBlock }, ] = await BridgeSwapUsdtParserBlockInfo.findOrCreate({
      where: { network: this.network },
      defaults: {
        network: this.network,
        lastParsedBlock: this.contractProvider.eventViewingHeight,
      },
    });

    this.Logger.debug('Last collected block "%s"', lastParsedBlock);

    return lastParsedBlock;
  }

  protected async onEvent(eventsData: EventData) {
    this.Logger.info('Event handler: name "%s", block number "%s", address "%s"',
      eventsData.event,
      eventsData.blockNumber,
      eventsData.address,
    );

    if (eventsData.event === SwapUsdtEvents.SwapInitialized) {
      return this.swapInitializedEventHandler(eventsData);
    }
  }

  protected updateBlockViewHeight(blockHeight: number) {
    this.Logger.debug('Update blocks: new block height "%s"', blockHeight);

    return BridgeSwapUsdtParserBlockInfo.update({ lastParsedBlock: blockHeight }, {
      where: {
        network: this.network,
        lastParsedBlock: { [Op.lt]: blockHeight },
      }
    });
  }

  public async swapInitializedEventHandler(eventsData: EventData) {
    const transactionHash = eventsData.transactionHash.toLowerCase();
    const recipient = eventsData.returnValues.recipient.toLowerCase();

    this.Logger.debug(
      'Swap initialized event handler: timestamp "%s", event data %o',
      eventsData.returnValues.timestamp, eventsData
    );

    const [_, isEventCreated] = await BridgeSwapUsdtTokenEvent.findOrCreate({
      where: { transactionHash, network: this.network },
      defaults: {
        recipient,
        transactionHash,
        network: this.network,
        blockNumber: eventsData.blockNumber,
        event: SwapUsdtEvents.SwapInitialized,
        nonce: eventsData.returnValues.nonce,
        timestamp: eventsData.returnValues.timestamp,
        amount: eventsData.returnValues.amount,
        chainTo: eventsData.returnValues.chainTo,
        chainFrom: eventsData.returnValues.chainFrom,
        userId: eventsData.returnValues.userId,
        symbol: eventsData.returnValues.symbol,
      }
    });

    if (!isEventCreated) {
      this.Logger.warn('Swap initialized event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );
      return;
    }

    const isProcessCreated = !!await FirstWqtTransmissionData.findOne({ where: { txHashSwapInitialized: transactionHash } });

    if (isProcessCreated) {
      this.Logger.warn('Swap initialized event handler: event "%s" (tx hash "%s") is skipped because the payment happened earlier',
        eventsData.event,
        transactionHash,
      );
      return;
    }

    const transmissionData = await FirstWqtTransmissionData.create({
      txHashSwapInitialized: transactionHash,
      status: TransactionStatus.Pending,
    });

    const wqtPrice = await this.tokenPriceProvider.coinPriceInUSD(eventsData.returnValues.timestamp);

    if (!wqtPrice) {
      this.Logger.warn('The oracle provider did not receive data on the current price',
        eventsData.event,
        transactionHash,
      );

      await transmissionData.update({ status: TransmissionStatusFirstWqt.NoPriceWqtAtMoment });

      return;
    }

    const amountWqt = new BigNumber(eventsData.returnValues.amount)
      .shiftedBy(12)
      .div(wqtPrice)
      .shiftedBy(18)
      .toFixed(0)

    const ratio = await CommissionSettings.findByPk(CommissionTitle.CommissionSwapWQT);

    await transmissionData.update({
      amount: amountWqt,
      platformCommissionCoefficient: ratio.commission.value,
    });

    await sendFirstWqtJob({
      recipientAddress: recipient,
      ratio: ratio.commission.value,
      txHashSwapInitialized: transactionHash,
      amount: amountWqt,
    });

    return this.updateBlockViewHeight(eventsData.blockNumber);
  };

  public async collectAllUncollectedEvents(fromBlockNumber: number) {
    this.Logger.info('Start collecting all uncollected events from block number: %s.', fromBlockNumber);

    const { events, error, lastBlockNumber } = await this.contractProvider.getEvents(fromBlockNumber);

    for (const event of events) {
      try {
        await this.onEvent(event);
      } catch (e) {
        this.Logger.error(e, 'Event processing ended with error');

        throw e;
      }
    }

    await this.updateBlockViewHeight(lastBlockNumber);

    if (error) {
      throw error;
    }
  };

  public async syncBlocks() {
    const lastParsedBlock = await this.getLastCollectedBlock();

    await this.collectAllUncollectedEvents(lastParsedBlock);
  }

  public async start() {
    await this.collectAllUncollectedEvents(
      await this.getLastCollectedBlock()
    );
  }
}

export class BridgeUsdtListenerController extends BridgeUsdtController {
  constructor(
    protected readonly Logger: ILogger,
    public readonly network: BlockchainNetworks,
    protected readonly tokenPriceProvider: TokenPriceProvider,
    public readonly contractProvider: IContractListenerProvider,
  ) {
    super(Logger, network, contractProvider, tokenPriceProvider);
  }

  public async start() {
    await super.start();

    this.contractProvider.startListener(
      await this.getLastCollectedBlock()
    );

    this.contractProvider.on('events', (async (eventData) => {
      await this.onEvent(eventData);
    }));
  }
}
