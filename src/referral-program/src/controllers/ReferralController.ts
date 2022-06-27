import { Logger } from "../../logger/pino";
import { EventData } from 'web3-eth-contract';
import { ReferralClients } from "../providers/types";
import { IController, ReferralEvent, IContractProvider } from './types';
import {
  User,
  Wallet,
  RewardStatus,
  ReferralStatus,
  BlockchainNetworks,
  ReferralProgramReferral,
  ReferralProgramAffiliate,
  ReferralProgramParseBlock,
  ReferralProgramEventPaidReferral,
  ReferralProgramEventRewardClaimed,
  ReferralProgramEventRegisteredAffiliate, Media,
} from '@workquest/database-models/lib/models';

export class ReferralController implements IController {
  constructor(
    public readonly clients: ReferralClients,
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

  protected updateBlockViewHeight(blockHeight: number) {
    Logger.debug('Update blocks: new block height "%s"', blockHeight);

    return ReferralProgramParseBlock.update(
      { lastParsedBlock: blockHeight },
      { where: { network: this.network } }
    );
  }

  protected async registeredAffiliateEventHandler(eventsData: EventData) {
    const transactionHash = eventsData.transactionHash.toLowerCase();
    const referralAddress = eventsData.returnValues.referral.toLowerCase();
    const affiliateAddress = eventsData.returnValues.affiliate.toLowerCase();

    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    Logger.debug(
      'Registered affiliate event handler: timestamp "%s", event data %o',
      timestamp,
      eventsData,
    );

    const [, isCreated] = await ReferralProgramEventRegisteredAffiliate.findOrCreate({
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
      Logger.warn('Registered affiliate event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    await this.clients.notificationsBroker.sendNotification({
      data: eventsData,
      action: eventsData.event,
      recipients: [referralAddress],
    });

    const [referralWallet,] = await Promise.all([
      Wallet.findOne({
        where: { address: referralAddress },
      }),
      this.updateBlockViewHeight(eventsData.blockNumber),
    ]);

    if (!referralWallet) {
      Logger.warn('Registered Affiliate event handler: event "%s" (tx hash "%s") handling is skipped because referral wallet not found',
        eventsData.event,
        transactionHash,
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
    const affiliateAddress = eventsData.returnValues.affiliate.toLowerCase();

    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    Logger.debug('Paid referral event handler: timestamp "%s", event data %o',
      timestamp,
      eventsData,
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
      Logger.warn('Paid referral event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    const userInfo = await User.unscoped().findOne({
      attributes: ['id', "firstName", "lastName"],
      include: [{
        model: Wallet,
        where: { address: referralAddress },
        as: 'wallet',
        required: true,
        attributes: []
      }, {
        model: Media.scope('urlOnly'),
        as: 'avatar',
      }]
    })

    eventsData['timestamp'] = timestamp

    await this.clients.notificationsBroker.sendNotification({
      data: { referral: userInfo, event: eventsData },
      action: eventsData.event,
      recipients: [affiliateAddress],
    });

    const [referralWallet,] = await Promise.all([
      Wallet.findOne({
        where: { address: referralAddress },
      }),
      this.updateBlockViewHeight(eventsData.blockNumber)
    ]);

    if (!referralWallet) {
      Logger.warn('Paid referral event handler: event "%s" (tx hash "%s") handling is skipped because referral wallet not found',
        eventsData.event,
        transactionHash,
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
    const affiliateAddress = eventsData.returnValues.affiliate.toLowerCase();

    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    Logger.debug(
      'Reward claimed event handler: timestamp "%s", event data %o',
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
      Logger.warn('Reward claimed event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    await this.clients.notificationsBroker.sendNotification({
      data: eventsData,
      action: eventsData.event,
      recipients: [affiliateAddress],
    });

    const [affiliateWallet,] = await Promise.all([
      Wallet.findOne({
        where: { address: affiliateAddress },
      }),
      this.updateBlockViewHeight(eventsData.blockNumber)
    ]);

    if (!affiliateWallet) {
      Logger.warn('Reward claimed event handler: event "%s" (tx hash "%s") handling is skipped because affiliate wallet not found',
        eventsData.event,
        transactionHash,
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

    const { collectedEvents, error, lastBlockNumber } = await this.contractProvider.getAllEvents(fromBlockNumber);

    for (const event of collectedEvents) {
      try {
        await this.onEvent(event);
      } catch (e) {
        Logger.error(e, 'Event processing ended with error');

        throw e;
      }
    }

    await this.updateBlockViewHeight(lastBlockNumber);

    if (error) {
      throw error;
    }
  }

}
