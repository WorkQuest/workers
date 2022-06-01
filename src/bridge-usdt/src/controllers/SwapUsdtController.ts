import { Op } from "sequelize";
import BigNumber from "bignumber.js";
import { Logger } from "../../logger/pino";
import { EventData } from "web3-eth-contract";
import { IContractProvider } from "../../../types";
import { IController, SwapUsdtEvents } from "./types";
import { sendFirstWqtJob } from "../../jobs/sendFirstWqt";
import { SwapUsdtClients, TokenPriceProvider } from "../providers/types";
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

export class SwapUsdtController implements IController {
  constructor(
    public readonly clients: SwapUsdtClients,
    public readonly network: BlockchainNetworks,
    public readonly contractProvider: IContractProvider,
    private readonly tokenPriceProvider: TokenPriceProvider,
  ) {
    this.contractProvider.subscribeOnEvents(async (eventData) => {
      await this.onEvent(eventData);
    });
  }

  private async onEvent(eventsData: EventData) {
    Logger.info('Event handler: name "%s", block number "%s", address "%s"',
      eventsData.event,
      eventsData.blockNumber,
      eventsData.address,
    );

    if (eventsData.event === SwapUsdtEvents.SwapInitialized) {
      return this.swapInitializedEventHandler(eventsData);
    }
  }

  protected updateBlockViewHeight(blockHeight: number) {
    Logger.debug('Update blocks: new block height "%s"', blockHeight);

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

    Logger.debug(
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
      Logger.warn('Swap initialized event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );
      return;
    }

    const isProcessCreated = !!await FirstWqtTransmissionData.findOne({ where: { txHashSwapInitialized: transactionHash } });

    if (isProcessCreated) {
      Logger.warn('Swap initialized event handler: event "%s" (tx hash "%s") is skipped because the payment happened earlier',
        eventsData.event,
        transactionHash,
      );
      return;
    }

    const transmissionData = await FirstWqtTransmissionData.create({
      txHashSwapInitialized: transactionHash,
      status: TransactionStatus.Pending,
    });

    const wqtPrice = await this.getTokensPriceInUsd(eventsData.returnValues.timestamp);

    if (!wqtPrice) {
      Logger.warn('The oracle provider did not receive data on the current price',
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

  private getTokensPriceInUsd(timestamp: string | number): Promise<number> {
    return this.tokenPriceProvider.coinPriceInUSD(timestamp);
  };

  public async collectAllUncollectedEvents(fromBlockNumber: number) {
    Logger.info('Start collecting all uncollected events from block number: %s.', fromBlockNumber);

    const { collectedEvents, error, lastBlockNumber } = await this.contractProvider.getAllEvents(fromBlockNumber);

    for (const event of collectedEvents) {
      try {
        await this.onEvent(event);
      } catch (e) {
        Logger.error(e, 'Event processing ended with error');

        throw e;
      }
    }

    await this.updateBlockViewHeight(lastBlockNumber);

    if (error) {
      throw error;
    }
  };
}
