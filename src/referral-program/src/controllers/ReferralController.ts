import {IController, ReferralEvent} from './types';
import {EventData} from 'web3-eth-contract';
import {Clients, IContractProvider} from "../providers/types";
import {ReferralMessageBroker} from "./BrokerController";
import {
  Wallet,
  RewardStatus,
  ReferralStatus,
  BlockchainNetworks,
  ReferralProgramReferral,
  ReferralProgramAffiliate,
  ReferralProgramParseBlock,
  ReferralProgramEventPaidReferral,
  ReferralProgramEventRewardClaimed,
  ReferralProgramEventRegisteredAffiliate,
} from '@workquest/database-models/lib/models';

export class ReferralController implements IController {
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
    if (eventsData.event === ReferralEvent.PaidReferral) {
      return this.paidReferralEventHandler(eventsData);
    } else if (eventsData.event === ReferralEvent.RegisteredAffiliate) {
      return this.registeredAffiliateEventHandler(eventsData);
    } else if (eventsData.event === ReferralEvent.RewardClaimed) {
      return this.rewardClaimedEventHandler(eventsData);
    }
  }

  protected async registeredAffiliateEventHandler(eventsData: EventData) {
    const transactionHash = eventsData.transactionHash.toLowerCase();
    const referralAddress = eventsData.returnValues.referral.toLowerCase();
    const affiliateAddress = eventsData.returnValues.affiliat.toLowerCase();

    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const [_, isCreated] = await ReferralProgramEventRegisteredAffiliate.findOrCreate({
      where: { transactionHash, network: this.network },
      defaults: {
        timestamp,
        transactionHash,
        referral: referralAddress,
        affiliate: affiliateAddress,
        blockNumber: eventsData.blockNumber,
        network: this.network,
      },
    });

    if (!isCreated) {
      return;
    }

    ReferralMessageBroker.sendReferralNotification({
      data: eventsData,
      action: eventsData.event,
      recipients: [referralAddress],
    });

    const [referralWallet, ] = await Promise.all([
      Wallet.findOne({
        where: { address: referralAddress },
      }),
      ReferralProgramParseBlock.update(
        { lastParsedBlock: eventsData.blockNumber },
        { where: { network: this.network } },
      ),
    ]);

    if (!referralWallet) {
      return; // TODO add pino
    }

    return ReferralProgramReferral.update(
      { referralStatus: ReferralStatus.Registered },
      { where: { referralUserId: referralWallet.userId } },
    );
  }

  protected async paidReferralEventHandler(eventsData: EventData) {
    const transactionHash = eventsData.transactionHash.toLowerCase();
    const referralAddress = eventsData.returnValues.referral.toLowerCase();
    const affiliateAddress = eventsData.returnValues.affiliat.toLowerCase();

    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const [_, isCreated] = await ReferralProgramEventPaidReferral.findOrCreate({
      where: { transactionHash, network: this.network },
      defaults: {
        timestamp,
        transactionHash,
        referral: referralAddress,
        affiliate: affiliateAddress,
        blockNumber: eventsData.blockNumber,
        amount: eventsData.returnValues.amount,
        network: this.network,
      },
    });

    if (!isCreated) {
      return;
    }

    ReferralMessageBroker.sendReferralNotification({
      data: eventsData,
      action: eventsData.event,
      recipients: [affiliateAddress],
    });

    const [referralWallet, ] = await Promise.all([
      Wallet.findOne({
        where: { address: referralAddress },
      }),
      ReferralProgramParseBlock.update(
        { lastParsedBlock: eventsData.blockNumber },
        { where: { network: this.network } },
      ),
    ]);

    if (!referralWallet) {
      return; // TODO add pino
    }

    await ReferralProgramReferral.update(
      { referralStatus: RewardStatus.Paid },
      { where: { referralUserId: referralWallet.userId } },
    );
  }

  protected async rewardClaimedEventHandler(eventsData: EventData) {
    const transactionHash = eventsData.transactionHash.toLowerCase();
    const affiliateAddress = eventsData.returnValues.affiliat.toLowerCase();

    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const [_, isCreated] = await ReferralProgramEventRewardClaimed.findOrCreate({
      where: { transactionHash, network: this.network },
      defaults: {
        timestamp,
        transactionHash,
        affiliate: affiliateAddress,
        blockNumber: eventsData.blockNumber,
        amount: eventsData.returnValues.amount,
        network: this.network,
      },
    });

    if (!isCreated) {
      return;
    }

    ReferralMessageBroker.sendReferralNotification({
      data: eventsData,
      action: eventsData.event,
      recipients: [affiliateAddress],
    });

    const [affiliateWallet, ] = await Promise.all([
      Wallet.findOne({
        where: { address: affiliateAddress },
      }),
      ReferralProgramParseBlock.update(
        { lastParsedBlock: eventsData.blockNumber },
        { where: { network: this.network } },
      ),
    ]);

    if (!affiliateWallet) {
      return; // TODO add pino
    }

    await ReferralProgramAffiliate.update(
      { status: RewardStatus.Claimed },
      { where: { affiliateUserId: affiliateWallet.userId } },
    );
  }

  public async collectAllUncollectedEvents(fromBlockNumber: number) {
    const { collectedEvents, isGotAllEvents, lastBlockNumber } = await this.contractProvider.getAllEvents(fromBlockNumber);

    for (const event of collectedEvents) {
      try {
        await this.onEvent(event);
      } catch (e) {
        console.error('Failed to process all events. Last processed block: ' + event.blockNumber);
        throw e;
      }
    }

    await ReferralProgramParseBlock.update(
      { lastParsedBlock: lastBlockNumber },
      { where: {network: this.network} },
    );

    if (!isGotAllEvents) {
      throw new Error('Failed to process all events. Last processed block: ' + lastBlockNumber);
    }
  }
}
