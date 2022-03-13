import { EventData } from "web3-eth-contract";
import { Clients, IContractProvider } from "../providers/types";
import { BlockchainNetworks } from '@workquest/database-models/lib/models';

export enum ReferralEvent {
  RegisteredAffiliate = 'RegisteredAffiliat', /** On contract RegisteredAffiliat (without e) */
  RewardClaimed = 'RewardClaimed',
  PaidReferral = 'PaidReferral',
}

export interface IController {
  readonly clients: Clients;
  readonly network: BlockchainNetworks;
  readonly contractProvider: IContractProvider;

  collectAllUncollectedEvents(fromBlockNumber: number): Promise<void>;
}

export type Notification = {
  recipients: string[],
  action: string,
  data: EventData,
}
