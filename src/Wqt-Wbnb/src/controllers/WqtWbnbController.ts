import { Op } from "sequelize";
import BigNumber from 'bignumber.js';
import { WqtWbnbEvent } from './types';
import { Logger } from "../../logger/pino";
import { EventData } from 'web3-eth-contract';
import {
  Coin,
  Web3Provider,
  TokenPriceProvider,
} from '../providers/types';
import {
  DailyLiquidity,
  WqtWbnbBlockInfo,
  WqtWbnbSwapEvent,
  WqtWbnbMintEvent,
  WqtWbnbSyncEvent,
  WqtWbnbBurnEvent,
  BlockchainNetworks,
} from '@workquest/database-models/lib/models';

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

  protected updateBlockViewHeight(blockHeight: number): Promise<any> {
    Logger.debug('Update blocks: new block height "%s"', blockHeight);

    return WqtWbnbBlockInfo.update({ lastParsedBlock: blockHeight }, {
      where: {
        network: this.network,
        lastParsedBlock: { [Op.lt]: blockHeight },
      }
    });
  }

  private async onEvent(eventsData: EventData) {
    Logger.info('Event handler: name %s, block number %s, address %s',
      eventsData.event,
      eventsData.blockNumber,
      eventsData.address,
    );

    if (eventsData.event === WqtWbnbEvent.Swap) {
      await this.swapEventHandler(eventsData);
    } else if (eventsData.event === WqtWbnbEvent.Mint) {
      await this.mintEventHandler(eventsData);
    } else if (eventsData.event === WqtWbnbEvent.Burn) {
      await this.burnEventHandler(eventsData);
    } else if (eventsData.event === WqtWbnbEvent.Sync) {
      await this.syncEventHandler(eventsData);
    }
  }

  protected async syncEventHandler(eventsData: EventData) {
    const { timestamp } = await this.web3Provider.web3.eth.getBlock(eventsData.blockNumber);

    const transactionHash = eventsData.transactionHash.toLocaleLowerCase();

    const [wqtWbnbSyncEvent, isCreated] = await WqtWbnbSyncEvent.findOrCreate({
      where: { transactionHash },
      defaults: {
        transactionHash,
        timestamp: timestamp,
        blockNumber: eventsData.blockNumber,
      }
    });

    if (!isCreated) {
      Logger.warn('Sync event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    Logger.debug('Sync event handler: timestamp "%s", event data %o',
      timestamp,
      eventsData,
    );

    const tokenBNBPriceInUsd = await this.getTokenPriceInUsd(timestamp as string, Coin.BNB);
    const tokenWQTPriceInUsd = await this.getTokenPriceInUsd(timestamp as string, Coin.WQT);

    Logger.debug('Sync event handler: tokens price in usd: bnb "%s", wqt "%s"',
      tokenBNBPriceInUsd,
      tokenWQTPriceInUsd,
    );

    const bnbPool = new BigNumber(eventsData.returnValues.reserve0).shiftedBy(-18);
    const wqtPool = new BigNumber(eventsData.returnValues.reserve1).shiftedBy(-18);

    Logger.debug('Sync event handler: tokens pool in usd: bnb "%s", wqt "%s"',
      bnbPool,
      wqtPool,
    );

    const bnbPoolInUsd = bnbPool.multipliedBy(tokenBNBPriceInUsd);
    const wqtPoolInUsd = wqtPool.multipliedBy(tokenWQTPriceInUsd);

    const poolToken = bnbPoolInUsd
      .plus(wqtPoolInUsd)
      .toString()

    Logger.debug('Sync event handler: tokens pool in usd "%s"', poolToken);

    const currentDaySinceEpochBeginning = new BigNumber(timestamp)
      .dividedBy(86400)
      .toNumber()
      .toFixed()

    const lastDailyLiquidity = await DailyLiquidity.findOne({ where: { daySinceEpochBeginning: currentDaySinceEpochBeginning } });

    if (!lastDailyLiquidity) {
      await DailyLiquidity.create({
        daySinceEpochBeginning: currentDaySinceEpochBeginning,
        date: timestamp,
        blockNumber: eventsData.blockNumber,
        bnbPool: bnbPool.toString(),
        wqtPool: wqtPool.toString(),
        usdPriceBNB: tokenBNBPriceInUsd.toString(),
        usdPriceWQT: tokenWQTPriceInUsd.toString(),
        reserveUSD: poolToken,
      });
    } else {
      await lastDailyLiquidity.update({
        date: timestamp,
        blockNumber: eventsData.blockNumber,
        bnbPool: bnbPool.toString(),
        wqtPool: wqtPool.toString(),
        usdPriceBNB: tokenBNBPriceInUsd.toString(),
        usdPriceWQT: tokenWQTPriceInUsd.toString(),
        reserveUSD: poolToken,
      })
    }

    await Promise.all([
      this.updateBlockViewHeight(eventsData.blockNumber),
      wqtWbnbSyncEvent.update({ reserve0: bnbPool, reserve1: wqtPool }),
    ]);
  }

  protected async swapEventHandler(eventsData: EventData) {
    const { timestamp } = await this.web3Provider.web3.eth.getBlock(eventsData.blockNumber);

    const to = eventsData.returnValues.to.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    Logger.debug(
      'Swap event handler: timestamp "%s", event data %o',
      timestamp,
      eventsData,
    );

    const tokensPriceInUsd =
      eventsData.returnValues.amount0Out !== '0'
        ? await this.getTokensPriceInUsd(timestamp as string, Coin.BNB, parseInt(eventsData.returnValues.amount0Out))
        : await this.getTokensPriceInUsd(timestamp as string, Coin.WQT, parseInt(eventsData.returnValues.amount1Out));

    Logger.debug('Swap event handler: tokens price in usd "%s"', tokensPriceInUsd);

    const usdAmount = new BigNumber(tokensPriceInUsd).shiftedBy(-18);

    const [, isCreated] = await WqtWbnbSwapEvent.findOrCreate({
      where: { transactionHash },
      defaults: {
        to,
        transactionHash,
        timestamp: timestamp,
        amountUSD: usdAmount.toString(),
        blockNumber: eventsData.blockNumber,
        amount0In: eventsData.returnValues.amount0In,
        amount1In: eventsData.returnValues.amount1In,
        amount0Out: eventsData.returnValues.amount0Out,
        amount1Out: eventsData.returnValues.amount1Out,
      },
    });

    if (!isCreated) {
      Logger.warn('Swap event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    await this.updateBlockViewHeight(eventsData.blockNumber);
  }

  protected async mintEventHandler(eventsData: EventData) {
    const { timestamp } = await this.web3Provider.web3.eth.getBlock(eventsData.blockNumber);

    const sender = eventsData.returnValues.sender.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    Logger.debug(
      'Mint event handler: timestamp "%s", event data %o',
      timestamp,
      eventsData,
    );

    const [, isCreated] = await WqtWbnbMintEvent.findOrCreate({
      where: { transactionHash },
      defaults: {
        sender,
        timestamp,
        transactionHash,
        blockNumber: eventsData.blockNumber,
        amount0: eventsData.returnValues.amount0,
        amount1: eventsData.returnValues.amount1,
      }
    });

    if (!isCreated) {
      Logger.warn('Mint event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    await this.updateBlockViewHeight(eventsData.blockNumber);
  }

  protected async burnEventHandler(eventsData: EventData) {
    const { timestamp } = await this.web3Provider.web3.eth.getBlock(eventsData.blockNumber);

    const to = eventsData.returnValues.to.toLowerCase();
    const sender = eventsData.returnValues.sender.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    Logger.debug(
      'Burn event handler: timestamp "%s", event data %o',
      timestamp,
      eventsData,
    );

    const [, isCreated] = await WqtWbnbBurnEvent.findOrCreate({
      where: { transactionHash },
      defaults: {
        to,
        sender,
        timestamp,
        blockNumber: eventsData.blockNumber,
        amount0: eventsData.returnValues.amount0,
        amount1: eventsData.returnValues.amount1,
      }
    });

    if (!isCreated) {
      Logger.warn('Burn event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    await this.updateBlockViewHeight(eventsData.blockNumber);
  }

  private async getTokensPriceInUsd(timestamp: string | number, coin: Coin, coinAmount = 1): Promise<number> {
    const coinPriceInUsd = await this.tokenPriceProvider.coinPriceInUSD(timestamp, coin);

    return coinPriceInUsd * coinAmount;
  }

  private getTokenPriceInUsd(timestamp: string | number, coin: Coin): Promise<number> {
    return this.tokenPriceProvider.coinPriceInUSD(timestamp, coin);
  }

  public async collectAllUncollectedEvents(fromBlockNumber: number) {
    Logger.info('Start collecting all uncollected events from block number: %s.', fromBlockNumber);

    const { collectedEvents, error, lastBlockNumber } = await this.web3Provider.getAllEvents(fromBlockNumber);

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
