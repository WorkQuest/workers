import {
  WqtWbnbBlockInfo,
  WqtWbnbSwapEvent,
  WqtWbnbMintEvent,
  WqtWbnbBurnEvent,
  BlockchainNetworks,
} from '@workquest/database-models/lib/models';
import BigNumber from 'bignumber.js';
import { Coin, TokenPriceProvider, Web3Provider } from '../providers/types';
import { WqtWbnbEvent } from './types';
import { EventData } from 'web3-eth-contract';

export class WqtWbnbController {
  constructor(
    private readonly web3Provider: Web3Provider,
    private readonly tokenPriceProvider: TokenPriceProvider,
    private readonly network: BlockchainNetworks,
  ) {
    this.web3Provider.subscribeOnEvents(async (eventData) => {
      await this.onEvent(eventData);
    });
  }

  private async onEvent(eventsData: EventData) {
    if (eventsData.event === WqtWbnbEvent.Swap) {
      return this.swapEventHandler(eventsData);
    } else if (eventsData.event === WqtWbnbEvent.Mint) {
      return this.mintEventHandler(eventsData);
    } else if (eventsData.event === WqtWbnbEvent.Burn) {
      return this.burnEventHandler(eventsData);
    }
  }

  protected async swapEventHandler(eventsData: EventData) {
    const block = await this.web3Provider.web3.eth.getBlock(eventsData.blockNumber);

    const tokenPriceInUsd =
      eventsData.returnValues.amount0Out !== '0'
        ? await this.getTokenPriceInUsd(block.timestamp as string, Coin.BNB, parseInt(eventsData.returnValues.amount0Out))
        : await this.getTokenPriceInUsd(block.timestamp as string, Coin.WQT, parseInt(eventsData.returnValues.amount1Out));

    const usdAmount = new BigNumber(tokenPriceInUsd).shiftedBy(-18);

    await WqtWbnbSwapEvent.findOrCreate({
      where: { transactionHash: eventsData.transactionHash },
      defaults: {
        timestamp: block.timestamp,
        amountUSD: usdAmount.toString(),
        blockNumber: eventsData.blockNumber,
        to: eventsData.returnValues.to,
        transactionHash: eventsData.transactionHash,
        amount0In: eventsData.returnValues.amount0In,
        amount1In: eventsData.returnValues.amount1In,
        amount0Out: eventsData.returnValues.amount0Out,
        amount1Out: eventsData.returnValues.amount1Out,
        network: this.network,
      },
    });

    await WqtWbnbBlockInfo.update(
      { lastParsedBlock: eventsData.blockNumber },
      {
        where: { network: this.network, },
      },
    );
  }

  protected async mintEventHandler(eventsData: EventData) {
    const block = await this.web3Provider.web3.eth.getBlock(eventsData.blockNumber);

    await WqtWbnbMintEvent.findOrCreate({
      where: { transactionHash: eventsData.transactionHash },
      defaults: {
        network: this.network,
        timestamp: block.timestamp,
        blockNumber: eventsData.blockNumber,
        amount0: eventsData.returnValues.amount0,
        amount1: eventsData.returnValues.amount1,
        sender: eventsData.returnValues.sender,
      }
    });

    await WqtWbnbBlockInfo.update(
      { lastParsedBlock: eventsData.blockNumber },
      {
        where: { network: this.network, },
      },
    );
  }

  protected async burnEventHandler(eventsData: EventData) {
    const block = await this.web3Provider.web3.eth.getBlock(eventsData.blockNumber);

    await WqtWbnbBurnEvent.findOrCreate({
      where: { transactionHash: eventsData.transactionHash },
      defaults: {
        network: this.network,
        timestamp: block.timestamp,
        blockNumber: eventsData.blockNumber,
        amount0: eventsData.returnValues.amount0,
        amount1: eventsData.returnValues.amount1,
        sender: eventsData.returnValues.sender,
        to: eventsData.returnValues.to,
      }
    });

    await WqtWbnbBlockInfo.update(
      { lastParsedBlock: eventsData.blockNumber },
      {
        where: { network: this.network, },
      },
    );
  }

  private async getTokenPriceInUsd(timestamp: string | number, coin: Coin, coinAmount = 1): Promise<number> {
    return (await this.tokenPriceProvider.coinPriceInUSD(timestamp, coin)) * coinAmount;
  }

  public async collectAllUncollectedEvents(fromBlockNumber: number) {
    const { collectedEvents, isGotAllEvents, lastBlockNumber } = await this.web3Provider.getAllEvents(fromBlockNumber);

    for (const event of collectedEvents) {
      try {
        await this.onEvent(event);
      } catch (e) {
        console.error('Failed to process all events. Last processed block: ' + event.blockNumber);
        throw e;
      }
    }

    await WqtWbnbBlockInfo.update(
      { lastParsedBlock: lastBlockNumber },
      {
        where: { network: this.network },
      },
    );

    if (!isGotAllEvents) {
      throw new Error('Failed to process all events. Last processed block: ' + collectedEvents[collectedEvents.length - 1]);
    }
  }
}
