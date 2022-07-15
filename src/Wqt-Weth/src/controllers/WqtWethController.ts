import Web3 from "web3";
import {Op} from "sequelize";
import BigNumber from 'bignumber.js';
import {Logger} from "../../logger/pino";
import {EventData} from 'web3-eth-contract';
import {INotificationClient} from "../../../middleware";
import {
  IController,
  WqtWethEvent,
  WqtWethNotificationActions,
} from './types';
import {
  Coin,
  IContractProvider,
  TokenPriceProvider,
  IContractListenerProvider,
} from '../providers/types';
import {
  WqtWethBlockInfo,
  WqtWethSwapEvent,
  WqtWethMintEvent,
  WqtWethSyncEvent,
  WqtWethBurnEvent,
  BlockchainNetworks,
  DailyLiquidityWqtWeth,
} from '@workquest/database-models/lib/models';

export class WqtWethController implements IController {
  constructor(
    public readonly web3: Web3,
    public readonly network: BlockchainNetworks,
    public readonly contractProvider: IContractProvider,
    public readonly notificationClient: INotificationClient,
    protected readonly tokenPriceProvider: TokenPriceProvider,
  ) {
  }

  public async getLastCollectedBlock(): Promise<number> {
    const [{ lastParsedBlock }, ] = await WqtWethBlockInfo.findOrCreate({
      where: { network: this.network },
      defaults: {
        network: this.network,
        lastParsedBlock: this.contractProvider.eventViewingHeight,
      },
    });

    Logger.debug('Last collected block: "%s"', lastParsedBlock);

    return lastParsedBlock;
  }

  protected async updateBlockViewHeight(blockHeight: number): Promise<any> {
    Logger.debug('Update blocks: new block height "%s"', blockHeight);

    await WqtWethBlockInfo.update({ lastParsedBlock: blockHeight }, {
      where: {
        network: this.network,
        lastParsedBlock: { [Op.lt]: blockHeight },
      }
    });
  }

  protected async onEvent(eventsData: EventData) {
    Logger.info('Event handler: name "%s", block number "%s", address "%s"',
      eventsData.event,
      eventsData.blockNumber,
      eventsData.address,
    );

    if (eventsData.event === WqtWethEvent.Swap) {
      await this.swapEventHandler(eventsData);
    } else if (eventsData.event === WqtWethEvent.Mint) {
      await this.mintEventHandler(eventsData);
    } else if (eventsData.event === WqtWethEvent.Burn) {
      await this.burnEventHandler(eventsData);
    } else if (eventsData.event === WqtWethEvent.Sync) {
      await this.syncEventHandler(eventsData);
    }
  }

  protected async syncEventHandler(eventsData: EventData) {
    const { timestamp } = await this.web3.eth.getBlock(eventsData.blockNumber);

    const transactionHash = eventsData.transactionHash.toLocaleLowerCase();

    Logger.debug('Sync event handler: timestamp "%s", event data %o',
      timestamp,
      eventsData,
    );

    const ethPool = new BigNumber(eventsData.returnValues.reserve1)
      .shiftedBy(-18)
      .toString()

    const wqtPool = new BigNumber(eventsData.returnValues.reserve0)
      .shiftedBy(-18)
      .toString()

    Logger.debug('Sync event handler: (tx hash "%s") tokens pool (shifted by -18): eth "%s", wqt "%s"',
      transactionHash,
      ethPool,
      wqtPool,
    );

    const [, isCreated] = await WqtWethSyncEvent.findOrCreate({
      where: { transactionHash },
      defaults: {
        transactionHash,
        reserve1: wqtPool,
        reserve0: ethPool,
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

    await this.updateBlockViewHeight(eventsData.blockNumber);

    const tokenETHPriceInUsd = await this.getTokenPriceInUsd(timestamp as string, Coin.ETH);
    const tokenWQTPriceInUsd = await this.getTokenPriceInUsd(timestamp as string, Coin.WQT);

    if (!tokenETHPriceInUsd || !tokenWQTPriceInUsd) {
      Logger.warn('Sync event handler: (tx hash "%s") tokens price (eth "%s", wqt "%s") in usd at timestamp "%s" moment is not found',
        transactionHash,
        tokenETHPriceInUsd,
        tokenWQTPriceInUsd,
        timestamp,
      );

      return;
    }

    Logger.debug('Sync event handler: (tx hash "%s") tokens price in usd: eth "%s", wqt "%s"',
      transactionHash,
      tokenETHPriceInUsd,
      tokenWQTPriceInUsd,
    );

    const entPoolInUsd = new BigNumber(tokenETHPriceInUsd)
      .shiftedBy(-18)
      .multipliedBy(ethPool)

    const wqtPoolInUsd = new BigNumber(tokenWQTPriceInUsd)
      .shiftedBy(-18)
      .multipliedBy(wqtPool)

    const poolToken = entPoolInUsd
      .plus(wqtPoolInUsd)
      .toString()

    Logger.debug('Sync event handler: (tx hash "%s") tokens pool in usd "%s"',
      transactionHash,
      poolToken,
    );

    const currentEventDaySinceEpochBeginning = new BigNumber(timestamp)
      .dividedToIntegerBy(86400)
      .toNumber()

    Logger.debug('Sync event handler: (tx hash "%s") day since unix epoch "%s"',
      transactionHash,
      currentEventDaySinceEpochBeginning,
    );

    const [, isDailyLiquidityCreated] = await DailyLiquidityWqtWeth.findOrCreate({
      where: { daySinceEpochBeginning: currentEventDaySinceEpochBeginning },
      defaults: {
        date: timestamp,
        ethPool: ethPool,
        wqtPool: wqtPool,
        blockNumber: eventsData.blockNumber,
        usdPriceETH: tokenETHPriceInUsd.toString(),
        usdPriceWQT: tokenWQTPriceInUsd.toString(),
        reserveUSD: poolToken,
      }
    });

    if (!isDailyLiquidityCreated) {
      await DailyLiquidityWqtWeth.update({
        date: timestamp,
        ethPool: ethPool,
        wqtPool: wqtPool,
        blockNumber: eventsData.blockNumber,
        usdPriceETH: tokenETHPriceInUsd.toString(),
        usdPriceWQT: tokenWQTPriceInUsd.toString(),
        reserveUSD: poolToken,
      }, {
        where: {
          date: { [Op.lt]: timestamp },
          daySinceEpochBeginning: currentEventDaySinceEpochBeginning,
        }
      });
    }

    await this.notificationClient.notify({
      action: WqtWethNotificationActions.Sync,
      recipients: [],
      data: await DailyLiquidityWqtWeth.findOne({
        where: { daySinceEpochBeginning: currentEventDaySinceEpochBeginning }
      }),
    });
  }

  protected async swapEventHandler(eventsData: EventData) {
    const { timestamp } = await this.web3.eth.getBlock(eventsData.blockNumber);

    const to = eventsData.returnValues.to.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    Logger.debug('Swap event handler: timestamp "%s", event data %o',
      timestamp,
      eventsData,
    );

    const [wqtWethSwapEvent, isCreated] = await WqtWethSwapEvent.findOrCreate({
      where: { transactionHash },
      defaults: {
        to,
        transactionHash,
        timestamp: timestamp,
        blockNumber: eventsData.blockNumber,
        /** Не трогать последовательность! Сети токенов BNB и ETH под значениями amount0/1 отдают разное значения токена */
        amount0In: eventsData.returnValues.amount1In,
        amount1In: eventsData.returnValues.amount0In,
        amount0Out: eventsData.returnValues.amount1Out,
        amount1Out: eventsData.returnValues.amount0Out,
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

    /** Не трогать последовательность! Сети токенов BNB и ETH под значениями amount0/1 отдают разное значения токена */
    const trackedToken = eventsData.returnValues.amount0Out !== '0'
      ? { symbol: Coin.WQT, value: eventsData.returnValues.amount0Out }
      : { symbol: Coin.ETH, value: eventsData.returnValues.amount1Out }

    const tokensPriceInUsd = await this.getTokensPriceInUsd(timestamp as string, trackedToken.symbol, parseInt(trackedToken.value))

    if (!tokensPriceInUsd) {
      Logger.warn('Swap event handler: (tx hash "%s") token price (%s) in usd at timestamp "%s" is not found',
        transactionHash,
        trackedToken.symbol.toLowerCase(),
        timestamp,
      );

      return;
    }

    Logger.debug('Swap event handler: (tx hash "%s") tokens price (%s) in usd "%s"',
      transactionHash,
      trackedToken.symbol.toLowerCase(),
      tokensPriceInUsd
    );

    const usdAmount = new BigNumber(tokensPriceInUsd)
      .shiftedBy(-18 * 2)
      .toString()

    await wqtWethSwapEvent.update({ amountUSD: usdAmount });
  }

  protected async mintEventHandler(eventsData: EventData) {
    const { timestamp } = await this.web3.eth.getBlock(eventsData.blockNumber);

    const sender = eventsData.returnValues.sender.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    Logger.debug('Mint event handler: timestamp "%s", event data %o',
      timestamp,
      eventsData,
    );

    const [, isCreated] = await WqtWethMintEvent.findOrCreate({
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
    const { timestamp } = await this.web3.eth.getBlock(eventsData.blockNumber);

    const to = eventsData.returnValues.to.toLowerCase();
    const sender = eventsData.returnValues.sender.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    Logger.debug('Burn event handler: timestamp "%s", event data %o',
      timestamp,
      eventsData,
    );

    const [, isCreated] = await WqtWethBurnEvent.findOrCreate({
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
    const { events, error, lastBlockNumber } = await this.contractProvider.getEvents(fromBlockNumber);

    for (const event of events) {
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

export class WqtWethListenerController extends WqtWethController {
  constructor(
    public readonly web3: Web3,
    public readonly network: BlockchainNetworks,
    public readonly notificationClient: INotificationClient,
    protected readonly tokenPriceProvider: TokenPriceProvider,
    public readonly contractProvider: IContractListenerProvider,
  ) {
    super(web3, network, contractProvider, notificationClient, tokenPriceProvider);
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
