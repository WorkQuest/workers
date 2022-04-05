import {IController, ReferralEvent} from './types';
import {EventData} from 'web3-eth-contract';
import {Clients, IContractProvider} from "../providers/types";
import {ReferralMessageBroker} from "./BrokerController";
import { Logger } from "../../logger/pino";
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
    Logger.info('Event handler: name %s, block number %s, address %s',
      eventsData.event,
      eventsData.blockNumber,
      eventsData.address,
    );

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

    Logger.debug(
      'Registered affiliate event handler: timestamp "%s", event data o%',
      timestamp, eventsData
    );

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
      Logger.warn('Registered affiliate event handler (event timestamp "%s"): event "%s" handling is skipped because it has already been created',
        timestamp,
        eventsData.event
      );

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
      Logger.warn('Registered Affiliate event handler (event timestamp "%s"): referral wallet not found',
        timestamp,
        eventsData.event
      );

      return;
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

    Logger.debug(
      'Paid referral event handler: timestamp "%s", event data o%',
      timestamp, eventsData
    );

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
      Logger.warn('Paid referral event handler (event timestamp "%s"): event "%s" handling is skipped because it has already been created',
        timestamp,
        eventsData.event
      );

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
      Logger.warn('Paid referral event handler (event timestamp "%s"): referral wallet not found',
        timestamp,
        eventsData.event
      );

      return;
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

    Logger.debug(
      'Reward claimed event handler: timestamp "%s", event data o%',
      timestamp, eventsData
    );

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
      Logger.warn('Reward claimed event handler (event timestamp "%s"): event "%s" handling is skipped because it has already been created',
        timestamp,
        eventsData.event
      );

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
      Logger.warn('Reward claimed event handler (event timestamp "%s"): affiliate wallet not found',
        timestamp,
        eventsData.event
      );

      return;
    }

    await ReferralProgramAffiliate.update(
      { status: RewardStatus.Claimed },
      { where: { affiliateUserId: affiliateWallet.userId } },
    );
  }

  public async collectAllUncollectedEvents(fromBlockNumber: number) {
    Logger.info('Start collecting all uncollected events from block number: %s.', fromBlockNumber);

    const { collectedEvents, isGotAllEvents, lastBlockNumber } = await this.contractProvider.getAllEvents(fromBlockNumber);

    for (const event of collectedEvents) {
      try {
        await this.onEvent(event);
      } catch (e) {
        Logger.error(e, 'Event processing ended with error');

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
