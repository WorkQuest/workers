import { Op } from "sequelize";
import { Logger } from "../../logger/pino";
import { EventData } from "web3-eth-contract";
import { IContractProvider } from "../../../types";
import { SwapUsdtClients, TokenPriceProvider } from "../providers/types";
import { IController, SwapUsdtEvents } from "./types";
import {
  BlockchainNetworks,
  SwapUsdtParserBlockInfo,
  SwapUsdtSwapTokenEvent,
} from "@workquest/database-models/lib/models";
import { sendFirstWqt } from "../../jobs/sendFirstWqt";
import BigNumber from "bignumber.js";

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

    return SwapUsdtParserBlockInfo.update({ lastParsedBlock: blockHeight }, {
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

    const [_, isCreated] = await SwapUsdtSwapTokenEvent.findOrCreate({
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
    })

    if (!isCreated) {
      Logger.warn('Swap initialized event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );
      return;
    }
    //TODO нужно придумать вычисление получше не пройдёт тут такое!!!!!
    // @ts-ignore
    const amountWqt = new BigNumber(eventsData.returnValues.amount).shiftedBy(+12) /
      await this.getTokensPriceInUsd(eventsData.returnValues.timestamp)

    await sendFirstWqt({
      recipientWallet: recipient,
      network: this.network,
      userId: eventsData.returnValues.userId,
      amount: amountWqt,
      txSwap: transactionHash,
    })
    return this.updateBlockViewHeight(eventsData.blockNumber);
  }

  private async getTokensPriceInUsd(timestamp: string | number): Promise<number> {
    return await this.tokenPriceProvider.coinPriceInUSD(timestamp);
  }

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
  }
}
