import { PensionFundEvent } from './types';
import { EventData } from 'web3-eth-contract';
import {
  BlockchainNetworks,
  PensionFundBlockInfo,
  PensionFundReceivedEvent,
  PensionFundWithdrewEvent,
  PensionFundWalletUpdatedEvent,
} from '@workquest/database-models/lib/models';
import { Clients, IContractProvider } from "../providers/types";

export class PensionFundController {
  constructor(
    public readonly clients: Clients,
    public readonly network: BlockchainNetworks,
    public readonly contractProvider: IContractProvider,
  ) {
    this.contractProvider.subscribeOnEvents(async (eventData) => {
      await this.onEvent(eventData);
    });
  }

  private async onEvent(eventsData: EventData) {
    if (eventsData.event === PensionFundEvent.Received) {
      await this.receivedEventHandler(eventsData);
    } else if (eventsData.event === PensionFundEvent.Withdrew) {
      await this.withdrewEventHandler(eventsData);
    } else if (eventsData.event === PensionFundEvent.WalletUpdated) {
      await this.walletUpdatedEventHandler(eventsData);
    }
  }

  protected async receivedEventHandler(eventsData: EventData) {
    const block = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    await PensionFundReceivedEvent.findOrCreate({
      where: { transactionHash: eventsData.transactionHash },
      defaults: {
        timestamp: block.timestamp,
        blockNumber: eventsData.blockNumber,
        transactionHash: eventsData.transactionHash.toLowerCase(),
        user: eventsData.returnValues.user.toLowerCase(),
        amount: eventsData.returnValues.amount,
        event: PensionFundEvent.Received,
        network: this.network,
      },
    });

    await PensionFundBlockInfo.update(
      { lastParsedBlock: eventsData.blockNumber },
      {
        where: { network: this.network },
      },
    );
  }

  protected async withdrewEventHandler(eventsData: EventData) {
    const block = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    await PensionFundWithdrewEvent.findOrCreate({
      where: { transactionHash: eventsData.transactionHash },
      defaults: {
        timestamp: block.timestamp,
        blockNumber: eventsData.blockNumber,
        transactionHash: eventsData.transactionHash.toLowerCase(),
        user: eventsData.returnValues.user.toLowerCase(),
        amount: eventsData.returnValues.amount,
        event: PensionFundEvent.Withdrew,
        network: this.network,
      },
    });

    await PensionFundBlockInfo.update(
      { lastParsedBlock: eventsData.blockNumber },
      {
        where: { network: this.network },
      },
    );
  }

  protected async walletUpdatedEventHandler(eventsData: EventData) {
    const block = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    await PensionFundWalletUpdatedEvent.findOrCreate({
      where: { transactionHash: eventsData.transactionHash },
      defaults: {
        timestamp: block.timestamp,
        blockNumber: eventsData.blockNumber,
        transactionHash: eventsData.transactionHash.toLowerCase(),
        user: eventsData.returnValues.user.toLowerCase(),
        newFee: eventsData.returnValues.newFee,
        unlockDate: eventsData.returnValues.unlockDate,
        event: PensionFundEvent.WalletUpdated,
        network: this.network,
      },
    });

    await PensionFundBlockInfo.update(
      { lastParsedBlock: eventsData.blockNumber },
      {
        where: { network: this.network },
      },
    );
  }

  public async collectAllUncollectedEvents(fromBlockNumber: number) {
    const { collectedEvents, isGotAllEvents, lastBlockNumber } = await this.contractProvider.getAllEvents(fromBlockNumber);

    for (const event of collectedEvents) {
      try {
        await this.onEvent(event);
      } catch (e) {
        console.error('Failed to process all events. Last processed block: ' + event.blockNumber); throw e;
      }
    }

    await PensionFundBlockInfo.update(
      { lastParsedBlock: lastBlockNumber },
      {
        where: { network: this.network },
      },
    );

    if (!isGotAllEvents) {
      throw new Error('Failed to process all events. Last processed block: ' + lastBlockNumber);
    }
  }
}
