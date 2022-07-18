import Web3 from "web3";
import {Op} from "sequelize";
import {EventData} from 'web3-eth-contract';
import {addJob} from "../../../utils/scheduler";
import {ILogger, RaiseViewEvent, StatisticPayload} from './types';
import {updateUserRaiseViewStatusJob} from "../../jobs/updateUserRaiseViewStatus";
import {updateQuestRaiseViewStatusJob} from "../../jobs/updateQuestRaiseViewStatus";
import {IController, IContractProvider, IContractListenerProvider} from '../../../types';
import {
  User,
  Quest,
  Wallet,
  UserRaiseView,
  UserRaiseType,
  QuestRaiseType,
  QuestRaiseView,
  UserRaiseStatus,
  QuestRaiseStatus,
  RaiseViewBlockInfo,
  BlockchainNetworks,
  RaiseViewPromotedUserEvent,
  RaiseViewPromotedQuestEvent,
  RaiseViewsPlatformStatisticFields,
} from '@workquest/database-models/lib/models';

export class RaiseViewController implements IController {
  constructor(
    public readonly web3: Web3,
    protected readonly Logger: ILogger,
    public readonly network: BlockchainNetworks,
    public readonly contractProvider: IContractProvider,
  ) {
  }

  private async writeUserStatistic(payload: StatisticPayload) {
    const tariffs = {
      Bronze: RaiseViewsPlatformStatisticFields.ProfilesBronze,
      Silver: RaiseViewsPlatformStatisticFields.ProfilesSilver,
      Gold: RaiseViewsPlatformStatisticFields.ProfilesGold,
      GoldPlus: RaiseViewsPlatformStatisticFields.ProfilesGoldPlus
    };

    if (payload.oldTariff) {
      await addJob('writeActionStatistics', { incrementField: tariffs[UserRaiseType[payload.oldTariff]], statistic: 'raiseView', type: 'decrement' });
    }

    await Promise.all([
      addJob('writeActionStatistics', { incrementField: RaiseViewsPlatformStatisticFields.ProfilesTotal, statistic: 'raiseView' }),
      addJob('writeActionStatistics', { incrementField: tariffs[UserRaiseType[payload.newTariff]], statistic: 'raiseView', type: 'increment' }),
      addJob('writeActionStatistics', { incrementField: RaiseViewsPlatformStatisticFields.ProfilesSum, statistic: 'raiseView', by: payload.amount }),
    ]);
  }

  private async writeQuestStatistic(payload: StatisticPayload) {
    const tariffs = {
      Bronze: RaiseViewsPlatformStatisticFields.QuestsBronze,
      Silver: RaiseViewsPlatformStatisticFields.QuestsSilver,
      Gold: RaiseViewsPlatformStatisticFields.QuestsGold,
      GoldPlus: RaiseViewsPlatformStatisticFields.QuestsGoldPlus,
    };

    if (payload.oldTariff) {
      await addJob('writeActionStatistics', { incrementField: tariffs[QuestRaiseType[payload.oldTariff]], statistic: 'raiseView', type: 'decrement' });
    }

    await Promise.all([
      addJob('writeActionStatistics', { incrementField: RaiseViewsPlatformStatisticFields.QuestsTotal, statistic: 'raiseView' }),
      addJob('writeActionStatistics', { incrementField: tariffs[QuestRaiseType[payload.newTariff]], statistic: 'raiseView', type: 'increment' }),
      addJob('writeActionStatistics', { incrementField: RaiseViewsPlatformStatisticFields.QuestsSum, statistic: 'raiseView', by: payload.amount }),
    ]);
  }

  public static toEndedAt(period: number): Date {
    return new Date(Date.now() + 86400000 * period);
  }

  public async getLastCollectedBlock(): Promise<number> {
    const [{ lastParsedBlock }, ] = await RaiseViewBlockInfo.findOrCreate({
      where: { network: this.network },
      defaults: {
        network: this.network,
        lastParsedBlock: this.contractProvider.eventViewingHeight,
      },
    });

    this.Logger.debug('Last collected block: "%s"', lastParsedBlock);

    return lastParsedBlock;
  }

  protected async updateBlockViewHeight(blockHeight: number) {
    this.Logger.debug('Update blocks: new block height "%s"', blockHeight);

    await RaiseViewBlockInfo.update({ lastParsedBlock: blockHeight }, {
      where: {
        network: this.network,
        lastParsedBlock: { [Op.lt]: blockHeight },
      }
    });
  }

  protected async onEvent(eventsData: EventData) {
    this.Logger.info('Event handler: name "%s", block number "%s", address "%s"',
      eventsData.event,
      eventsData.blockNumber,
      eventsData.address,
    );

    if (eventsData.event === RaiseViewEvent.Profile) {
      await this.promotedUserEventHandler(eventsData);
    } else if (eventsData.event === RaiseViewEvent.Quest) {
      await this.promotedQuestEventHandler(eventsData);
    }
  }

  protected async promotedQuestEventHandler(eventsData: EventData) {
    const { timestamp } = await this.web3.eth.getBlock(eventsData.blockNumber);

    const tariff = eventsData.returnValues.tariff;
    const period = eventsData.returnValues.period;
    const promotedAt = eventsData.returnValues.promotedAt;
    const amount = eventsData.returnValues.amount;

    const transactionHash = eventsData.transactionHash.toLowerCase();
    const questContractAddress = eventsData.returnValues.quest.toLowerCase();

    this.Logger.debug('Promoted quest event handler: timestamp "%s", event data %o',
      timestamp,
      eventsData,
    );

    const quest = await Quest.findOne({ where: { contractAddress: questContractAddress } });

    this.Logger.debug('Promoted quest event handler: quest data %o', quest);

    const [promotedQuestEvent, isCreated] = await RaiseViewPromotedQuestEvent.findOrCreate({
      where: { transactionHash, network: this.network },
      defaults: {
        tariff,
        period,
        timestamp,
        promotedAt,
        transactionHash,
        quest: questContractAddress,
        blockNumber: eventsData.blockNumber,
        network: this.network,
      }
    });

    if (!isCreated) {
      this.Logger.warn('Promoted quest event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    await this.updateBlockViewHeight(eventsData.blockNumber);

    if (!quest) {
      this.Logger.warn('Promoted quest event handler: event "%s" handling is skipped because quest entity not found',
        eventsData.event,
      );

      return;
    }

    this.Logger.debug('Promoted quest event handler: event "%s" (tx hash "%s") quest data %o',
      eventsData.event,
      transactionHash,
      { questId: quest.id, role: quest.status },
    );

    const [questRaiseView, ] = await QuestRaiseView.findOrCreate({
      where: { questId: quest.id },
      defaults: { questId: quest.id },
    });

    this.Logger.debug('Promoted quest event handler: event "%s" (tx hash "%s") quest raise view data %o',
      eventsData.event,
      transactionHash,
      questRaiseView,
    );

    if (questRaiseView.status === QuestRaiseStatus.Paid) {
      this.Logger.warn('Promoted quest event handler: quest (quest address "%s", tx hash "%s") promotion already activated, data will be overwritten',
        questContractAddress,
        transactionHash,
      );
    }

    await this.writeQuestStatistic({
      oldTariff: questRaiseView.type,
      newTariff: tariff,
      amount
    });

    await Promise.all([
      updateQuestRaiseViewStatusJob({
        questId: quest.id,
        runAt: RaiseViewController.toEndedAt(period),
      }),
      questRaiseView.update({
        type: tariff,
        duration: period,
        status: QuestRaiseStatus.Paid,
        endedAt: RaiseViewController.toEndedAt(period),
      }),
    ]);

    this.Logger.debug('Promoted quest event handler: create "%s"', transactionHash);
  }

  protected async promotedUserEventHandler(eventsData: EventData) {
    const { timestamp } = await this.web3.eth.getBlock(eventsData.blockNumber);

    const tariff = eventsData.returnValues.tariff;
    const period = eventsData.returnValues.period;
    const promotedAt = eventsData.returnValues.promotedAt;
    const amount = eventsData.returnValues.amount;

    const transactionHash = eventsData.transactionHash.toLowerCase();
    const userWalletAddress = eventsData.returnValues.user.toLowerCase();

    this.Logger.debug('Promoted user event handler: timestamp "%s", event data %o',
      timestamp,
      eventsData,
    );

    const user = await User.unscoped().findOne({
      include: {
        model: Wallet,
        as: 'wallet',
        where: { address: userWalletAddress },
      },
    });

    this.Logger.debug('Promoted user event handler: quest data %o', user);

    const [promotedUserEvent, isCreated] = await RaiseViewPromotedUserEvent.findOrCreate({
      where: { transactionHash, network: this.network },
      defaults: {
        tariff,
        period,
        timestamp,
        promotedAt,
        transactionHash,
        user: userWalletAddress,
        blockNumber: eventsData.blockNumber,
        network: this.network,
      }
    });

    if (!isCreated) {
      this.Logger.warn('Promoted user event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    await this.updateBlockViewHeight(eventsData.blockNumber);

    if (!user) {
      this.Logger.warn('Promoted user event handler: event "%s" handling is skipped because user entity not found',
        eventsData.event,
      );

      return;
    }

    this.Logger.debug('Promoted user event handler: event "%s" (tx hash "%s") user data %o',
      eventsData.event,
      transactionHash,
      { userId: user.id, role: user.role },
    );

    const [userRaiseView, ] = await UserRaiseView.findOrCreate({
      where: { userId: user.id },
      defaults: { userId: user.id },
    });

    this.Logger.debug('Promoted user event handler: event "%s" (tx hash "%s") user raise view data %o',
      eventsData.event,
      transactionHash,
      userRaiseView,
    );

    if (userRaiseView.status === UserRaiseStatus.Paid) {
      this.Logger.warn('Promoted user event handler: user (address "%s", tx hash "%s") promotion already activated, data will be overwritten',
        userWalletAddress,
        transactionHash,
      );
    }

    await this.writeUserStatistic({
      oldTariff: userRaiseView.type,
      newTariff: tariff,
      amount
    });

    await Promise.all([
      userRaiseView.update({
        type: tariff,
        duration: period,
        status: QuestRaiseStatus.Paid,
        endedAt: RaiseViewController.toEndedAt(period),
      }),
      updateUserRaiseViewStatusJob({
        userId: user.id,
        runAt: RaiseViewController.toEndedAt(period),
      }),
    ]);

    this.Logger.debug('Promoted user event handler: create "%s"', transactionHash);
  }

  public async collectAllUncollectedEvents(fromBlockNumber: number) {

    this.Logger.info('Start collecting all uncollected events from block number: %s.', fromBlockNumber);

    const { events, error, lastBlockNumber } = await this.contractProvider.getEvents(fromBlockNumber);

    for (const event of events) {
      try {
        await this.onEvent(event);
      } catch (error) {
        this.Logger.error(error, 'Event processing ended with error');

        throw error;
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

export class RaiseViewListenerController extends RaiseViewController {
  constructor(
    public readonly web3: Web3,
    protected readonly Logger: ILogger,
    public readonly network: BlockchainNetworks,
    public readonly contractProvider: IContractListenerProvider,
  ) {
    super(web3, Logger, network, contractProvider);
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
