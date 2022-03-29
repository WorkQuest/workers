import Web3 from "web3";
import {Contract, EventData} from "web3-eth-contract";
import {BlockchainNetworks} from "@workquest/database-models/lib/models";

export type onEventCallBack = {
  (eventData): void;
};

export interface IContractCacheProvider<Payload> {
  get(questContactAddress: string): Promise<Payload | null>;
  set(questContactAddress: string, payload: Payload): Promise<any>;
}

export interface Clients {
  readonly web3: Web3;
}

export interface IContractProvider {
  startListener(): void;
  subscribeOnEvents(onEventCallBack: onEventCallBack): void;
  getAllEvents(fromBlockNumber: number): Promise<{ collectedEvents: EventData[], isGotAllEvents: boolean, lastBlockNumber: number }>;
}

export interface IController {
  readonly network: BlockchainNetworks;
  readonly contractProvider: IContractProvider;

  collectAllUncollectedEvents(fromBlockNumber: number): Promise<void>;
}

