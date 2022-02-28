import {ReferralEvent} from './types';
import {EventData} from 'web3-eth-contract';
import {Web3Provider} from "../providers/types";
import {
  Wallet,
  BlockchainNetworks,
  ReferralParseBlock,
  ReferralEventPaidReferral,
  ReferralEventRegisteredAffiliate,
  ReferralEventRewardClaimed
} from '@workquest/database-models/lib/models';


export class ReferralController {
  constructor(
    private readonly web3Provider: Web3Provider,
    private readonly network: BlockchainNetworks,
  ) {
    this.web3Provider.subscribeOnEvents(async (eventData) => {
      await this.onEvent(eventData);
    });
  }

  private async onEvent(eventsData: EventData) {
    if (eventsData.event === ReferralEvent.PaidReferral) {
      await this.paidReferralEventHandler(eventsData);
    } else if (eventsData.event === ReferralEvent.RegisteredAffiliat) {
      await this.registeredAffiliatEventHandler(eventsData);
    } else if (eventsData.event === ReferralEvent.RewardClaimed) {
      await this.rewardClaimedEventHandler(eventsData);
    }
  }

  protected async paidReferralEventHandler(eventsData: EventData) {
    const block = await this.web3Provider.web3.eth.getBlock(eventsData.blockNumber);

    await ReferralEventPaidReferral.findOrCreate({
      where: {transactionHash: eventsData.transactionHash},
      defaults: {
        blockNumber: eventsData.blockNumber,
        transactionHash: eventsData.transactionHash.toLowerCase(),
        referral: eventsData.returnValues.referral.toLowerCase(),
        affiliat: eventsData.returnValues.affiliat.toLowerCase(),
        amount: eventsData.returnValues.amount,
        timestamp: block.timestamp,
        network: this.network,
      },
    });

    await ReferralParseBlock.update(
      {lastParsedBlock: eventsData.blockNumber},
      {
        where: {network: this.network},
      },
    );
  }

  protected async registeredAffiliatEventHandler(eventsData: EventData) {
    const block = await this.web3Provider.web3.eth.getBlock(eventsData.blockNumber);

    await ReferralEventRegisteredAffiliate.findOrCreate({
      where: {transactionHash: eventsData.transactionHash},
      defaults: {
        blockNumber: eventsData.blockNumber,
        transactionHash: eventsData.transactionHash.toLowerCase(),
        referral: eventsData.returnValues.referral.toLowerCase(),
        affiliat: eventsData.returnValues.affiliat.toLowerCase(),
        timestamp: block.timestamp,
        network: this.network,
      },
    });

    await ReferralParseBlock.update(
      {lastParsedBlock: eventsData.blockNumber},
      {
        where: {network: this.network},
      },
    );
  }

  protected async rewardClaimedEventHandler(eventsData: EventData) {
    const block = await this.web3Provider.web3.eth.getBlock(eventsData.blockNumber);

    await ReferralEventRewardClaimed.findOrCreate({
      where: {transactionHash: eventsData.transactionHash},
      defaults: {
        blockNumber: eventsData.blockNumber,
        transactionHash: eventsData.transactionHash.toLowerCase(),
        affiliat: eventsData.returnValues.affiliat.toLowerCase(),
        amount: eventsData.returnValues.amount.toLowerCase(),
        timestamp: block.timestamp,
        network: this.network,
      },
    });

    await ReferralParseBlock.update(
      {lastParsedBlock: eventsData.blockNumber},
      {
        where: {network: this.network},
      },
    );
  }

  public async collectAllUncollectedEvents(fromBlockNumber: number) {
    const {collectedEvents, isGotAllEvents, lastBlockNumber} = await this.web3Provider.getAllEvents(fromBlockNumber);

    for (const event of collectedEvents) {
      try {
        await this.onEvent(event);
      } catch (e) {
        console.error('Failed to process all events. Last processed block: ' + event.blockNumber);
        throw e;
      }
    }

    await ReferralParseBlock.update(
      {lastParsedBlock: lastBlockNumber},
      {
        where: {network: this.network},
      },
    );

    if (!isGotAllEvents) {
      throw new Error('Failed to process all events. Last processed block: ' + collectedEvents[collectedEvents.length - 1]);
    }
  }
}
