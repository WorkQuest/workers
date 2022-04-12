import {Clients, IContractProvider} from "../providers/types";
import {BlockchainNetworks} from "@workquest/database-models/lib/models";

export enum TrackedEvents {
  Borrowed = 'Borrowed',
  Claimed = 'Claimed',
  Received = 'Received',
  Refunded = 'Refunded'
}

export interface IController {
  readonly clients: Clients;
  readonly network: BlockchainNetworks;
  readonly contractProvider: IContractProvider;

  collectAllUncollectedEvents(fromBlockNumber: number): Promise<void>;
}
