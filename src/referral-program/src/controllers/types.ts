import { EventData } from "web3-eth-contract";

export enum ReferralEvent {
  RegisteredAffiliate = 'RegisteredAffiliat', /** On contract RegisteredAffiliat (without e) */
  RewardClaimed = 'RewardClaimed',
  PaidReferral = 'PaidReferral',
}

export type Notification = {
  recipients: string[],
  action: string,
  data: EventData,
}

export * from '../../../types';
