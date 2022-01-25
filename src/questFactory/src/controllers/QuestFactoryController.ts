import { QuestBlockInfo, QuestCreatedEvent, BlockchainNetworks, Quest, QuestStatus } from '@workquest/database-models/lib/models';
import { Web3Provider } from '../providers/types';
import { EventData } from 'web3-eth-contract';
import { QuestFactoryEvent } from './types';

export class QuestFactoryController {
  constructor(private readonly web3Provider: Web3Provider, private readonly network: BlockchainNetworks) {
    this.web3Provider.subscribeOnEvents(async (eventData) => {
      await this.onEvent(eventData);
    });
  }

  private async onEvent(eventsData: EventData) {
    if (eventsData.event === QuestFactoryEvent.Created) {
      await this.createdEventHandler(eventsData);
    }
  }

  protected async createdEventHandler(eventsData: EventData) {
    await QuestCreatedEvent.findOrCreate({
      where: {
        network: this.network,
        transactionHash: eventsData.transactionHash,
      },
      defaults: {
        network: this.network,
        nonce: eventsData.returnValues.nonce,
        jobHash: eventsData.returnValues.jobHash,
        employerAddress: eventsData.returnValues.employer,
        contractAddress: eventsData.returnValues.workquest,
        transactionHash: eventsData.transactionHash,
      },
    });

    await Quest.update(
      { status: QuestStatus.Created },
      {
        where: { nonce: eventsData.returnValues.nonce },
      },
    );

    await QuestBlockInfo.update(
      { lastParsedBlock: eventsData.blockNumber },
      {
        where: { network: this.network },
      },
    );
  }

  public async collectAllUncollectedEvents(lastBlockNumber: number) {
    const { collectedEvents, isGotAllEvents } = await this.web3Provider.getAllEvents(lastBlockNumber);

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
