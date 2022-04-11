import {Op} from "sequelize";
import {Logger} from "../../logger/pino";
import { EventData } from 'web3-eth-contract';
import { IController, RaiseViewEvent } from './types';
import { RaiseViewClients, IContractProvider } from '../providers/types';
import { updateUserRaiseViewStatusJob } from "../../jobs/updateUserRaiseViewStatus";
import { updateQuestRaiseViewStatusJob } from "../../jobs/updateQuestRaiseViewStatus";
import {
  User,
  Quest,
  Wallet,
  UserRaiseView,
  QuestRaiseView,
  UserRaiseStatus,
  QuestRaiseStatus,
  RaiseViewBlockInfo,
  BlockchainNetworks,
  RaiseViewPromotedUserEvent,
  RaiseViewPromotedQuestEvent,
} from '@workquest/database-models/lib/models';

export class RaiseViewController implements IController {
  constructor(
    public readonly clients: RaiseViewClients,
    public readonly contractProvider: IContractProvider,
    public readonly network: BlockchainNetworks,
  ) {
    this.contractProvider.subscribeOnEvents(async (eventData) => {
      return this.onEvent(eventData);
    });
  }

  public static toEndedAt(period: number): Date {
    return new Date(Date.now() + 86400000 * period);
  }

  protected updateBlockViewHeight(blockHeight: number): Promise<any> {
    Logger.debug('Update blocks: new block height "%s"', blockHeight);

    return RaiseViewBlockInfo.update({ lastParsedBlock: blockHeight }, {
      where: {
        network: this.network,
        lastParsedBlock: { [Op.lt]: blockHeight },
      }
    });
  }

  private async onEvent(eventsData: EventData) {
    Logger.info('Event handler: name "%s", block number "%s", address "%s"',
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
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const tariff = eventsData.returnValues.tariff;
    const period = eventsData.returnValues.period;
    const promotedAt = eventsData.returnValues.promotedAt;

    const transactionHash = eventsData.transactionHash.toLowerCase();
    const questContractAddress = eventsData.returnValues.quest.toLowerCase();

    Logger.debug('Promoted quest event handler: timestamp "%s", event data %o',
      timestamp,
      eventsData,
    );

    const quest = await Quest.findOne({ where: { contractAddress: questContractAddress } });

    Logger.debug('Promoted quest event handler: quest data %o', quest);

    const [,isCreated] = await RaiseViewPromotedQuestEvent.findOrCreate({
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
      Logger.warn('Promoted quest event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    await this.updateBlockViewHeight(eventsData.blockNumber);

    if (!quest) {
      Logger.warn('Promoted quest event handler: event "%s" handling is skipped because quest entity not found',
        eventsData.event,
      );

      return;
    }

    Logger.debug('Promoted quest event handler: event "%s" (tx hash "%s") quest data %o',
      eventsData.event,
      transactionHash,
      { questId: quest.id, role: quest.status },
    );

    const [questRaiseView, ] = await QuestRaiseView.findOrCreate({
      where: { questId: quest.id },
      defaults: { questId: quest.id },
    });

    Logger.debug('Promoted quest event handler: event "%s" (tx hash "%s") quest raise view data %o',
      eventsData.event,
      transactionHash,
      questRaiseView,
    );

    if (questRaiseView.status === QuestRaiseStatus.Paid) {
      Logger.warn('Promoted quest event handler: quest (quest address "%s", tx hash "%s") promotion already activated, data will be overwritten',
        questContractAddress,
        transactionHash,
      );
    }

    await Promise.all([
      updateQuestRaiseViewStatusJob({
        userId: quest.userId,
        runAt: RaiseViewController.toEndedAt(period),
      }),
      questRaiseView.update({
        type: tariff,
        duration: period,
        status: QuestRaiseStatus.Paid,
        endedAt: RaiseViewController.toEndedAt(period),
      }),
    ]);

    Logger.debug('Promoted quest event handler: create "%s"', transactionHash);
  }

  protected async promotedUserEventHandler(eventsData: EventData) {
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const tariff = eventsData.returnValues.tariff;
    const period = eventsData.returnValues.period;
    const promotedAt = eventsData.returnValues.promotedAt;

    const transactionHash = eventsData.transactionHash.toLowerCase();
    const userWalletAddress = eventsData.returnValues.user.toLowerCase();

    Logger.debug('Promoted user event handler: timestamp "%s", event data %o',
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

    Logger.debug('Promoted user event handler: quest data %o', user);

    const [, isCreated] = await RaiseViewPromotedUserEvent.findOrCreate({
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
      Logger.warn('Promoted user event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    await this.updateBlockViewHeight(eventsData.blockNumber);

    if (!user) {
      Logger.warn('Promoted user event handler: event "%s" handling is skipped because user entity not found',
        eventsData.event,
      );

      return;
    }

    Logger.debug('Promoted user event handler: event "%s" (tx hash "%s") user data %o',
      eventsData.event,
      transactionHash,
      { userId: user.id, role: user.role },
    );

    const [userRaiseView, ] = await UserRaiseView.findOrCreate({
      where: { userId: user.id },
      defaults: { userId: user.id },
    });

    Logger.debug('Promoted user event handler: event "%s" (tx hash "%s") user raise view data %o',
      eventsData.event,
      transactionHash,
      userRaiseView,
    );

    if (userRaiseView.status === UserRaiseStatus.Paid) {
      Logger.warn('Promoted user event handler: user (address "%s", tx hash "%s") promotion already activated, data will be overwritten',
        userWalletAddress,
        transactionHash,
      );
    }

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

    Logger.debug('Promoted user event handler: create "%s"', transactionHash);
  }

  public async collectAllUncollectedEvents(fromBlockNumber: number) {
    Logger.info('Start collecting all uncollected events from block number: %s.', fromBlockNumber);

    const { collectedEvents, error } = await this.contractProvider.getAllEvents(fromBlockNumber);

    for (const event of collectedEvents) {
      try {
        await this.onEvent(event);
      } catch (error) {
        Logger.error(error, 'Event processing ended with error');

        throw error;
      }
    }

    if (error) {
      throw error;
    }
  }
}