import { Web3Provider } from "../providers/types";
import {
  BlockchainNetworks, ProposalParseBlock,
  User,
  Wallet,
  WqtDelegateVotesChangedEvent,
  WqtParseBlock
} from "@workquest/database-models/lib/models";
import { EventData } from "web3-eth-contract";
import { WqtTrackedEvents } from "./types";

export class WqtController {
  constructor (
    private readonly web3Provider: Web3Provider,
    private readonly network: BlockchainNetworks,
  ) {
    this.web3Provider.subscribeOnEvents(async (eventData) => {
      await this.onEvent(eventData);
    });
  }

  private async onEvent(eventsData: EventData) {
    if (eventsData.event === WqtTrackedEvents.DelegateVotesChanged) {
      return this.wqtDelegateVotesChangedEventHandler(eventsData);
    }
  }

  protected updateLastParseBlock(lastParsedBlock: number): Promise<void> {
    return void WqtParseBlock.update(
      { lastParsedBlock },
      { where: { network: this.network } }
    );
  }

  protected async wqtDelegateVotesChangedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.web3Provider.web3.eth.getBlock(eventsData.blockNumber);

    const delegate = eventsData.returnValues.delegate.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    const user = await User.findOne({
      include: {
        model: Wallet,
        as: 'wallet',
        required: true,
        where: { address: delegate }
      }
    });

    await WqtDelegateVotesChangedEvent.findOrCreate({
      where: {
        transactionHash,
        network: this.network,
      },
      defaults: {
        timestamp,
        transactionHash,
        network: this.network,
        delegateAddress: delegate,
        userId: user ? user.id : null,
        blockNumber: eventsData.blockNumber,
        newBalance: eventsData.returnValues.newBalance,
        previousBalance: eventsData.returnValues.previousBalance,
      }
    });

    return await this.updateLastParseBlock(eventsData.blockNumber);
  }

  public async collectAllUncollectedEvents(fromBlockNumber: number) {
    const { collectedEvents, isGotAllEvents, lastBlockNumber } = await this.web3Provider.getAllEvents(fromBlockNumber);

    for (const event of collectedEvents) {
      try {
        await this.onEvent(event);
      } catch (e) {
        console.error('Failed to process all events. Last processed block: ' + event.blockNumber);
        throw e;
      }
    }

    await ProposalParseBlock.update(
      { lastParsedBlock: lastBlockNumber },
      { where: { network: this.network } }
    );

    if (!isGotAllEvents) {
      throw new Error('Failed to process all events. Last processed block: ' + collectedEvents[collectedEvents.length - 1]);
    }
  }
}
