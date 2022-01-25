import {BlockchainNetworks, PensionFundBlockInfo, ClaimedEvent, ReceivedEvent, WithdrewEvent} from '@workquest/database-models/lib/models';
import { PensionFundEvent } from './types';
import { EventData } from 'web3-eth-contract';
import {Web3Provider } from "../providers/types";

export class PensionFundController {
  constructor(
    private readonly web3Provider: Web3Provider,
    private readonly network: BlockchainNetworks,
  ) {
    this.web3Provider.subscribeOnEvents(async (eventData) => {
      await this.onEvent(eventData);
    });
  }

  private async onEvent(eventsData: EventData) {
    if (eventsData.event === PensionFundEvent.Received) {
      await this.receivedEventHandler(eventsData);
    } else if (eventsData.event === PensionFundEvent.Withdrew) {
      await this.withdrewEventHandler(eventsData);
    } else if (eventsData.event === PensionFundEvent.Claimed) {
      await this.claimedEventHandler(eventsData);
    }
  }

  protected async receivedEventHandler(eventsData: EventData) {
    const block = await this.web3Provider.web3.eth.getBlock(eventsData.blockNumber);

    await ReceivedEvent.findOrCreate({
      where: { transactionHash: eventsData.transactionHash },
      defaults: {
        timestamp: block.timestamp,
        blockNumber: eventsData.blockNumber,
        transactionHash: eventsData.transactionHash,
        user: eventsData.returnValues.user,
        amount: eventsData.returnValues.amount,
        network: this.network,
      },
    });

    await PensionFundBlockInfo.update(
      { lastParsedBlock: eventsData.blockNumber },
      {
        where: { network: BlockchainNetworks.bscMainNetwork },
      },
    );
  }

  protected async withdrewEventHandler(eventsData: EventData) {
    const block = await this.web3Provider.web3.eth.getBlock(eventsData.blockNumber);

    await WithdrewEvent.findOrCreate({
      where: { transactionHash: eventsData.transactionHash },
      defaults: {
        timestamp: block.timestamp,
        blockNumber: eventsData.blockNumber,
        transactionHash: eventsData.transactionHash,
        user: eventsData.returnValues.user,
        amount: eventsData.returnValues.amount,
        network: this.network,
      },
    });

    await PensionFundBlockInfo.update(
      { lastParsedBlock: eventsData.blockNumber },
      {
        where: { network: BlockchainNetworks.bscMainNetwork },
      },
    );
  }

  protected async claimedEventHandler(eventsData: EventData) {
    const block = await this.web3Provider.web3.eth.getBlock(eventsData.blockNumber);

    await ClaimedEvent.findOrCreate({
      where: { transactionHash: eventsData.transactionHash },
      defaults: {
        timestamp: block.timestamp,
        blockNumber: eventsData.blockNumber,
        transactionHash: eventsData.transactionHash,
        user: eventsData.returnValues.user,
        amount: eventsData.returnValues.amount,
        network: this.network,
      },
    });

    await PensionFundBlockInfo.update(
      { lastParsedBlock: eventsData.blockNumber },
      {
        where: { network: BlockchainNetworks.bscMainNetwork },
      },
    );
  }

  public async collectAllUncollectedEvents(lastBlockNumber: number) {
    const { collectedEvents, isGotAllEvents } = await this.web3Provider.getAllEvents(lastBlockNumber);

    for (const event of collectedEvents) {
      try {
        await this.onEvent(event);
      } catch (e) {
        console.error('Failed to process all events. Last processed block: ' + event.blockNumber);
        throw e;
      }
    }

    if (!isGotAllEvents) {
      throw new Error('Failed to process all events. Last processed block: ' + collectedEvents[collectedEvents.length - 1]);
    }
  }
}
