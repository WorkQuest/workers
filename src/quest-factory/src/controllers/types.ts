import { IContractProvider, Clients } from "../providers/types";
import { BlockchainNetworks } from "@workquest/database-models/lib/models";

export enum QuestFactoryEvent {
  Created = 'WorkQuestCreated',
}

export interface IController {
  readonly clients: Clients;
  readonly network: BlockchainNetworks;
  readonly contractProvider: IContractProvider;

  collectAllUncollectedEvents(fromBlockNumber: number): Promise<void>;
}

export interface ISupervisor {
  readonly controller: IController;

  scheduledInspections(): Promise<void>;
  blockHeightInspection(): Promise<void>;
  eventsInspection(fromBlockNumber: number): Promise<void>;
}
