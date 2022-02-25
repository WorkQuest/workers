import { EventData } from 'web3-eth-contract';
import {IController, QuestFactoryEvent} from './types';
import { IContractProvider, Clients } from '../providers/types';
import {
  Quest,
  QuestStatus,
  QuestBlockInfo,
  QuestFactoryStatus,
  BlockchainNetworks,
  QuestFactoryCreatedEvent,
} from '@workquest/database-models/lib/models';

export class QuestFactoryController implements IController {
  constructor(
    public readonly clients: Clients,
    public readonly contractProvider: IContractProvider,
    public readonly network: BlockchainNetworks,
  ) {
    this.contractProvider.subscribeOnEvents(async (eventData) => {
      await this.onEvent(eventData);
    });
  }

  private async onEvent(eventsData: EventData) {
    if (eventsData.event === QuestFactoryEvent.Created) {
      await this.createdEventHandler(eventsData);
    }
  }

  protected async createdEventHandler(eventsData: EventData) {
    const nonce = eventsData.returnValues.nonce;
    const jobHash = eventsData.returnValues.jobHash.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();
    const employerAddress = eventsData.returnValues.employer.toLowerCase();
    const contractAddress = eventsData.returnValues.workquest.toLowerCase();

    const quest = await Quest.findOne({ where: { nonce } });

    const questFactoryStatus = quest ?
      QuestFactoryStatus.Successfully : QuestFactoryStatus.QuestEntityNotFound;

    const [, isCreated] = await QuestFactoryCreatedEvent.findOrCreate({
      where: {
        transactionHash,
        network: this.network,
      },
      defaults: {
        nonce,
        jobHash,
        transactionHash,
        employerAddress,
        contractAddress,
        network: this.network,
        status: questFactoryStatus,
      },
    });

    if (isCreated) {
      await QuestBlockInfo.update({ lastParsedBlock: eventsData.blockNumber }, {
        where: { network: this.network },
      });

      await this.clients.questCacheProvider.set(contractAddress, { transactionHash, nonce });
    }
    if (quest && quest.status == QuestStatus.Pending) {
      await quest.update({ status: QuestStatus.Recruitment });
    }
  }

  public async collectAllUncollectedEvents(fromBlockNumber: number) {
    const { collectedEvents, isGotAllEvents } = await this.contractProvider.getAllEvents(fromBlockNumber);

    for (const event of collectedEvents) {
      try {
        await this.onEvent(event);
      } catch (err) {
        console.error('Failed to process all events. Last processed block: ' + event.blockNumber);
        throw err;
      }
    }

    if (!isGotAllEvents) {
      throw new Error('Failed to process all events. Last processed block: ' + collectedEvents[collectedEvents.length - 1]);
    }
  }
}
