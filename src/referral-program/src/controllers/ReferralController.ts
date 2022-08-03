import { Logger } from "../../logger/pino";
import { EventData } from 'web3-eth-contract';
import { IController, ReferralEvent, IContractProvider } from './types';
import {
  ReferralClients,
  IContractMQProvider,
  IContractWsProvider,
  IContractRpcProvider,
} from "../providers/types";
import {
  User,
  Media,
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
    public readonly clients: ReferralClients,
    public readonly network: BlockchainNetworks,
    public readonly contractProvider: IContractProvider | IContractRpcProvider,
  ) {
  }

  protected async onEvent(eventsData: EventData) {
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

  public async getLastCollectedBlock(): Promise<number> {
    const [{ lastParsedBlock },] = await ReferralProgramParseBlock.findOrCreate({
      where: { network: this.network },
      defaults: {
        network: this.network,
        lastParsedBlock: this.contractProvider.eventViewingHeight,
      },
    });

    Logger.debug('Last collected block: "%s"', lastParsedBlock);

    return lastParsedBlock;
  }

  protected async updateBlockViewHeight(blockHeight: number) {
    Logger.debug('Update blocks: new block height "%s"', blockHeight);

    await ReferralProgramParseBlock.update(
      { lastParsedBlock: blockHeight },
      { where: { network: this.network } },
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

    const [referralWallet, affiliateWallet] = await Promise.all([
      Wallet.findOne({
        where: { address: referralAddress },
      }),
      Wallet.findOne({
        where: { address: affiliateAddress }
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

    await this.clients.notificationsBroker.sendNotification({
      data: eventsData,
      action: eventsData.event,
      recipients: [referralWallet.userId, affiliateWallet.userId],
    });

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
    });

    const affiliateInfo = await User.unscoped().findOne({
      attributes: ['id'],
      include: [{
        model: Wallet,
        where: { address: affiliateAddress },
        as: 'wallet',
        required: true,
        attributes: []
      }],
    });

    if (affiliateInfo) {
      await this.clients.notificationsBroker.sendNotification({
        action: eventsData.event,
        recipients: [affiliateInfo.id],
        data: {
          referral: userInfo,
          event: { ...eventsData, timestamp },
        },
      });
    }

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

    await this.clients.notificationsBroker.sendNotification({
      data: eventsData,
      action: eventsData.event,
      recipients: [affiliateWallet.userId],
    });

    await ReferralProgramAffiliate.update(
      { status: RewardStatus.Claimed },
      { where: { affiliateUserId: affiliateWallet.userId } },
    );
  }

  public async collectAllUncollectedEvents(fromBlockNumber: number) {
    Logger.info('Start collecting all uncollected events from block number: %s.', fromBlockNumber);

    const { events, error, lastBlockNumber } = await this.contractProvider.getEvents(fromBlockNumber);

    for (const event of events) {
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

  public async syncBlocks() {
    const lastParsedBlock = await this.getLastCollectedBlock();

    await this.collectAllUncollectedEvents(lastParsedBlock);
  }

  public async start() {
    await this.collectAllUncollectedEvents(
      await this.getLastCollectedBlock()
    );
  }
}

export class ReferralListenerController extends ReferralController {
  constructor(
    public readonly clients: ReferralClients,
    public readonly network: BlockchainNetworks,
    public readonly contractProvider: IContractWsProvider | IContractMQProvider,
  ) {
    super(clients, network, contractProvider);
  }

  public async start() {
    await super.start();

    this.contractProvider.startListener(
      await this.getLastCollectedBlock()
    );

    this.contractProvider.on('events', (async (eventData) => {
      await this.onEvent(eventData);
    }));
  }
}

