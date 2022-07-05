import {Op} from "sequelize";
import {Logger} from "../../logger/pino";
import { EventData } from 'web3-eth-contract';
import { addJob } from "../../../utils/scheduler";
import { QuestFactoryClients, IContractProvider } from '../providers/types';
import { updateQuestsStatisticJob } from "../../jobs/updateQuestsStatistic";
import { IController, QuestFactoryEvent, QuestFactoryNotificationActions } from './types';
import {
  Quest,
  UserRole,
  QuestStatus,
  QuestFactoryStatus,
  BlockchainNetworks,
  QuestFactoryBlockInfo,
  QuestFactoryCreatedEvent,
  QuestsPlatformStatisticFields,
} from '@workquest/database-models/lib/models';


export class QuestFactoryController implements IController {
  constructor(
    public readonly clients: QuestFactoryClients,
    public readonly contractProvider: IContractProvider,
    public readonly network: BlockchainNetworks,
  ) {
  }

  public async getLastCollectedBlock(): Promise<number> {
    const [{ lastParsedBlock }, ] = await QuestFactoryBlockInfo.findOrCreate({
      where: { network: this.network },
      defaults: {
        network: this.network,
        lastParsedBlock: this.contractProvider.eventViewingHeight,
      },
    });

    Logger.debug('Last collected block: "%s"', lastParsedBlock);

    return lastParsedBlock;
  }

  protected async updateBlockViewHeight(blockHeight: number) {
    Logger.debug('Update blocks: new block height "%s"', blockHeight);

    await QuestFactoryBlockInfo.update({ lastParsedBlock: blockHeight }, {
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

    if (eventsData.event === QuestFactoryEvent.Created) {
      await this.createdEventHandler(eventsData);
    }
  }

  protected async createdEventHandler(eventsData: EventData) {
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const nonce = eventsData.returnValues.nonce;
    const jobHash = eventsData.returnValues.jobHash.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();
    const employerAddress = eventsData.returnValues.employer.toLowerCase();
    const contractAddress = eventsData.returnValues.workquest.toLowerCase();

    Logger.debug('Created event handler (quest nonce "%s"): timestamp "%s", event data %o', nonce, timestamp, eventsData);

    const quest = await Quest.findOne({ where: { nonce } });

    const questFactoryStatus = quest
      ? QuestFactoryStatus.Successfully
      : QuestFactoryStatus.QuestEntityNotFound

    Logger.debug('Created event handler (quest nonce "%s"): quest factory status "%s"', nonce, questFactoryStatus);

    const [, isCreated] = await QuestFactoryCreatedEvent.findOrCreate({
      where: {
        transactionHash,
        network: this.network,
      },
      defaults: {
        nonce,
        jobHash,
        timestamp,
        transactionHash,
        employerAddress,
        contractAddress,
        network: this.network,
        status: questFactoryStatus,
      },
    });

    if (!isCreated) {
      Logger.warn('Created event handler (quest nonce "%s"): event "%s" handling is skipped because it has already been created',
        nonce,
        eventsData.event
      );

      return;
    }

    await this.updateBlockViewHeight(eventsData.blockNumber);

    if (!quest) {
      Logger.warn('Created event handler (quest nonce "%s"): event "%s" quest handling is skipped because quest not found',
        nonce,
        eventsData.event,
      );

      return;
    }

    Logger.debug('Created event handler: quest id "%s", quest status "%s"', quest.id, quest.status);

    if (quest.status != QuestStatus.Pending) {
      Logger.warn('Created event handler (quest nonce "%s"): event "%s" quest handling is skipped because quest status does not match. ' +
        'Current quest status "%s"',
        nonce,
        eventsData.event,
        quest.status,
      );

      return;
    }

    await addJob('writeActionStatistics', {
      incrementedField: QuestsPlatformStatisticFields.Recruitment,
      statistic: 'quest',
    });

    await addJob('writeActionStatistics', {
      incrementedField: QuestsPlatformStatisticFields.Pending,
      statistic: 'quest',
      type: 'decrement'
    });

    await Promise.all([
      quest.update({ contractAddress, status: QuestStatus.Recruitment }),
      this.clients.questCacheProvider.set(contractAddress, { transactionHash, nonce }),
      updateQuestsStatisticJob({ userId: quest.userId, role: UserRole.Employer }),
      this.clients.notificationsBroker.sendNotification({
        recipients: [quest.userId],
        action: QuestFactoryNotificationActions.QuestStatusUpdated,
        data: quest
      }),
    ]);

    Logger.debug('Created event handler: set into redis key "%s", value %o', contractAddress, { transactionHash, nonce });
  }

  public async collectAllUncollectedEvents(fromBlockNumber: number) {
    Logger.info('Start collecting all uncollected events from block number: %s.', fromBlockNumber);

    const { events, error } = await this.contractProvider.getAllEvents(fromBlockNumber);

    for (const event of events) {
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

  public async syncBlocks() {
    const lastParsedBlock = await this.getLastCollectedBlock();

    await this.collectAllUncollectedEvents(lastParsedBlock);
  }

  public async start() {
    await this.collectAllUncollectedEvents(
      await this.getLastCollectedBlock()
    );

    this.contractProvider.startListener(
      await this.getLastCollectedBlock()
    );

    this.contractProvider.on('events', (async (eventData) => {
      await this.onEvent(eventData);
    }));
  }
}
