import { WqtTrackedEvents } from "./types";
import { EventData } from "web3-eth-contract";
import { Web3Provider } from "../providers/types";
import {
  User,
  Wallet,
  WqtParseBlock,
  BlockchainNetworks,
  WqtDelegateVotesChangedEvent,
} from "@workquest/database-models/lib/models";
import { Op } from "sequelize";

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
      { where: { network: this.network, lastParsedBlock: { [Op.lt]: lastParsedBlock } } },
    );
  }

  protected async wqtDelegateVotesChangedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.web3Provider.web3.eth.getBlock(eventsData.blockNumber);

    const delegator = eventsData.returnValues.delegator.toLowerCase();
    const delegate = eventsData.returnValues.delegatee.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    const [delegatorUser, delegateUser] = await Promise.all([
      User.unscoped().findOne({
        include: {
          model: Wallet,
          as: 'wallet',
          required: true,
          where: { address: delegator },
        }
      }),
      User.unscoped().findOne({
        include: {
          model: Wallet,
          as: 'wallet',
          required: true,
          where: { address: delegate },
        }
      })
    ]);

    const [_, isCreated] = await WqtDelegateVotesChangedEvent.findOrCreate({
      where: {
        transactionHash,
        network: this.network,
      },
      defaults: {
        delegate,
        delegator,
        timestamp,
        transactionHash,
        network: this.network,
        blockNumber: eventsData.blockNumber,
        newBalance: eventsData.returnValues.newBalance,
        delegateUserId: delegateUser ? delegateUser.id : null,
        delegatorUserId: delegatorUser ? delegatorUser.id : null,
        previousBalance: eventsData.returnValues.previousBalance,
      }
    });

    if (!isCreated) {
      return;
    }

    return this.updateLastParseBlock(eventsData.blockNumber);
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

    await this.updateLastParseBlock(lastBlockNumber);

    if (!isGotAllEvents) {
      throw new Error('Failed to process all events. Last processed block: ' + collectedEvents[collectedEvents.length - 1]);
    }
  }
}
