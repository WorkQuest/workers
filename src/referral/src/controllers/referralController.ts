import BigNumber from "bignumber.js";
import {ReferralEvent} from './types';
import {EventData} from 'web3-eth-contract';
import {Web3Provider} from "../providers/types";
import {
  Wallet,
  RewardStatus,
  ReferralStatus,
  ReferralProgram,
  BlockchainNetworks,
  ReferralParseBlock,
  ReferralProgramAffiliate,
  ReferralEventPaidReferral,
  ReferralEventRewardClaimed,
  ReferralEventRegisteredAffiliate,
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
    } else if (eventsData.event === ReferralEvent.RegisteredAffiliate) {
      await this.registeredAffiliateEventHandler(eventsData);
    } else if (eventsData.event === ReferralEvent.RewardClaimed) {
      await this.rewardClaimedEventHandler(eventsData);
    }
  }

  protected async paidReferralEventHandler(eventsData: EventData) {
    const referralAddress = eventsData.returnValues.referral.toLowerCase();
    const affiliateAddress = eventsData.returnValues.affiliat.toLowerCase();

    const block = await this.web3Provider.web3.eth.getBlock(eventsData.blockNumber);

    const [_, isCreated] = await ReferralEventPaidReferral.findOrCreate({
      where: {transactionHash: eventsData.transactionHash},
      defaults: {
        referral: referralAddress,
        affiliate: affiliateAddress,
        timestamp: block.timestamp,
        blockNumber: eventsData.blockNumber,
        amount: eventsData.returnValues.amount,
        transactionHash: eventsData.transactionHash.toLowerCase(),
        network: this.network,
      },
    });

    if (!isCreated) {
      return;
    }

    const [referralWallet, affiliateWallet, ] = await Promise.all([
      Wallet.findOne({
        where: { address: referralAddress }
      }),
      Wallet.findOne({
        where: { address: affiliateAddress }
      }),
      ReferralParseBlock.update(
        { lastParsedBlock: eventsData.blockNumber },
        { where: { network: this.network },
      }),
    ]);

    const [referralProgram, paidReferralEvents, ] = await Promise.all([
      ReferralProgram.findOne({
        where: { referrerUserId: referralWallet.userId }
      }),
      ReferralEventPaidReferral.findAll({
        where: { referral: referralAddress }
      }),
      ReferralParseBlock.update(
        { lastParsedBlock: eventsData.blockNumber },
        { where: { network: this.network },
        }),
    ]);

    const totalPaidAmounts = paidReferralEvents
      .map(v => new BigNumber(v.amount))
      .reduce((pValue, cValue) => pValue.plus(cValue))

    await Promise.all([
      referralProgram.update({ paidReward: totalPaidAmounts }),
      ReferralProgramAffiliate.update(
        { status: RewardStatus.Paid },
        { where: { affiliateUserId: affiliateWallet.userId, referralId: referralProgram.id } }
      ),
    ]);
  }

  protected async registeredAffiliateEventHandler(eventsData: EventData) {
    const block = await this.web3Provider.web3.eth.getBlock(eventsData.blockNumber);

    const [_, registeredAffiliateIsCreated] = await ReferralEventRegisteredAffiliate.findOrCreate({
      where: {transactionHash: eventsData.transactionHash},
      defaults: {
        blockNumber: eventsData.blockNumber,
        transactionHash: eventsData.transactionHash.toLowerCase(),
        referral: eventsData.returnValues.referral.toLowerCase(),
        affiliate: eventsData.returnValues.affiliat.toLowerCase(), // TODO Везде подправить affiliate
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
    if (registeredAffiliateIsCreated) {
      const usersReferralWallets = [eventsData.returnValues.referral.toLowerCase(), eventsData.returnValues.affiliat.toLowerCase()]
      const usersIdReferralProgram = []
      for (const user of usersReferralWallets) {
        const walletsReferralUsers = await Wallet.findOne({
          where: {address: user}
        })
        usersIdReferralProgram.push(walletsReferralUsers.userId)
      }
      const referralId = await ReferralProgram.findOne({
        where: {
          referrerUserId: usersIdReferralProgram[0]
        }
      })
      const affiliateInfos = await ReferralProgramAffiliate.findOne({
        where: {
          affiliateUserId: usersIdReferralProgram[1],
          referralId: referralId.referralId
        }
      })
      await affiliateInfos.update({
        status: ReferralStatus.Registered
      })
    }
  }

  protected async rewardClaimedEventHandler(eventsData: EventData) {
    const block = await this.web3Provider.web3.eth.getBlock(eventsData.blockNumber);

    const [_, rewardClaimedIsCreated] = await ReferralEventRewardClaimed.findOrCreate({
      where: {transactionHash: eventsData.transactionHash},
      defaults: {
        blockNumber: eventsData.blockNumber,
        transactionHash: eventsData.transactionHash.toLowerCase(),
        affiliate: eventsData.returnValues.affiliat.toLowerCase(),
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
    if (rewardClaimedIsCreated) {

      const walletReferralUser = await Wallet.findOne({
        where: {address: eventsData.returnValues.affiliat.toLowerCase()}
      })
      const userIdAffiliate = await ReferralProgramAffiliate.findOne({
        where: {
          affiliateUserId: walletReferralUser.userId,
        }
      })
      await userIdAffiliate.update({
        status: RewardStatus.Claimed
      })
    }
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
