import Web3 from "web3";
import {EventData} from "web3-eth-contract";
import {BlockchainNetworks} from "@workquest/database-models/lib/models";

export type onEventCallBack = {
  (eventData): void;
};

export interface IContractCacheProvider<Payload> {
  get(contractAddress: string): Promise<Payload | null>;
  set(contractAddress: string, payload: Payload): Promise<void>;
  remove(contractAddress: string): Promise<void>;
}

export interface Clients {
  readonly web3: Web3;
}

export interface IContractProvider {
  startListener(): void;
  subscribeOnEvents(onEventCallBack: onEventCallBack): void;
  getAllEvents(fromBlockNumber: number): Promise<{ collectedEvents: EventData[], error?: any, lastBlockNumber: number }>;
}

export interface IController {
  readonly network: BlockchainNetworks;
  readonly contractProvider: IContractProvider;

  collectAllUncollectedEvents(fromBlockNumber: number): Promise<void>;
}

