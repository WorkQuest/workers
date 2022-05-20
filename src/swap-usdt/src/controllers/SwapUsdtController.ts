import { Op } from "sequelize";
import BigNumber from "bignumber.js";
import { Logger } from "../../logger/pino";
import { EventData } from "web3-eth-contract";
import { IContractProvider } from "../../../types";
import { IController, SwapUsdtEvents } from "./types";
import { sendFirstWqtJob } from "../../jobs/sendFirstWqt";
import { SwapUsdtClients, TokenPriceProvider } from "../providers/types";
import {
  CommissionSettings,
  CommissionTitle,
  BlockchainNetworks,
  BridgeSwapUsdtParserBlockInfo, BridgeSwapUsdtTokenEvent,
  FirstWqtTransmissionData, TransmissionStatusFirstWqt
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

    const [_, isCreated] = await BridgeSwapUsdtTokenEvent.findOrCreate({
      where: { transactionHash, network: this.network },
      defaults: {
        transactionHash,
        blockNumber: eventsData.blockNumber,
        network: this.network,
        event: SwapUsdtEvents.SwapInitialized,
        nonce: eventsData.returnValues.nonce,
        timestamp: eventsData.returnValues.timestamp,
        recipient,
        amount: eventsData.returnValues.amount,
        chainTo: eventsData.returnValues.chainTo,
        chainFrom: eventsData.returnValues.chainFrom,
        userId: eventsData.returnValues.userId,
        symbol: eventsData.returnValues.symbol,
      }
    });

    if (!isCreated) {
      Logger.warn('Swap initialized event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );
      return;
    }

    const [, isRegistered] = await FirstWqtTransmissionData.findOrCreate({
      where: { txHashSwapInitialized: transactionHash },
      defaults: {
        txHashSwapInitialized: transactionHash,
        status: TransmissionStatusFirstWqt.Pending
      }
    });

    if (!isRegistered) {
      Logger.warn('Swap initialized event handler: event "%s" (tx hash "%s") is skipped because the payment happened earlier',
        eventsData.event,
        transactionHash,
      );
      return;
    }

    const wqtPrice = await this.getTokensPriceInUsd(eventsData.returnValues.timestamp);

    if (!wqtPrice) {
      Logger.warn('The oracle provider did not receive data on the current price',
        eventsData.event,
        transactionHash,
      );
      return;
    }

    const amountWqt = new BigNumber(eventsData.returnValues.amount).shiftedBy(+12).div(new BigNumber(wqtPrice));

    const ratio = await CommissionSettings.findOne({
      where: { title: CommissionTitle.CommissionSwapWQT }
    });

    await sendFirstWqtJob({
      txHashSwapInitialized: transactionHash,
      recipientWallet: recipient,
      amount: new BigNumber(amountWqt).shiftedBy(+18).toFixed(0),
      ratio: ratio.commission.value
    });


    return this.updateBlockViewHeight(eventsData.blockNumber);
  };

  private async getTokensPriceInUsd(timestamp: string | number): Promise<number> {
    return await this.tokenPriceProvider.coinPriceInUSD(timestamp);
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
