import { EventData } from 'web3-eth-contract';
import { QuestFactoryEvent } from './types';
import {ICacheProvider, IContractProvider} from '../providers/types';
import {
  Quest,
  QuestStatus,
  QuestBlockInfo,
  BlockchainNetworks,
  QuestFactoryCreatedEvent,
} from '@workquest/database-models/lib/models';

export class QuestFactoryController {
  constructor(
    private readonly questFactoryProvider: IContractProvider,
    private readonly questFactoryCacheProvider: ICacheProvider,
    private readonly network: BlockchainNetworks,
  ) {
    this.questFactoryProvider.subscribeOnEvents(async (eventData) => {
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

    const [, isCreated] = await QuestFactoryCreatedEvent.findOrCreate({
      where: {
        network: this.network,
        transactionHash: eventsData.transactionHash.toLowerCase(),
      },
      defaults: {
        nonce,
        jobHash,
        transactionHash,
        employerAddress,
        contractAddress,
        network: this.network,
      },
    });

    await Quest.update({ status: QuestStatus.Recruitment }, {
      where: {
        status: QuestStatus.Pending,
        // nonce: eventsData.returnValues.nonce,
      },
    });

    await QuestBlockInfo.update({ lastParsedBlock: eventsData.blockNumber }, {
      where: { network: this.network },
    });

    if (isCreated) {
      await this.questFactoryCacheProvider.set(contractAddress, { transactionHash, nonce });
    }
  }

  public async collectAllUncollectedEvents(lastBlockNumber: number) {
    const { collectedEvents, isGotAllEvents } = await this.questFactoryProvider.getAllEvents(lastBlockNumber);

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
