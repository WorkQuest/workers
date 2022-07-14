import Web3 from "web3";
import {EventData} from "web3-eth-contract";
import {BlockchainNetworks} from "@workquest/database-models/lib/models";

export type ReceivedEvents = {
  error?: any,
  events: EventData[],
  lastBlockNumber: number,
}

export type defaultConfigValues = {
  contractAddress: string,
  linkRpcProvider: string,
  parseEventsFromHeight: string,
}

export interface IContractCacheProvider<Payload> {
  get(contractAddress: string): Promise<Payload | null>;
  set(contractAddress: string, payload: Payload): Promise<void>;
  remove(contractAddress: string): Promise<void>;
}

export interface Clients {
  readonly web3: Web3;
}

export interface IContractProvider {
  readonly eventViewingHeight: number;

  getEvents(fromBlockNumber: number): Promise<ReceivedEvents>;
}

export interface IContractListenerProvider extends IContractProvider {
  on(type: 'error', callback: (error) => void);
  on(type: 'events', callback: (eventData) => void);

  isListening(): Promise<boolean>;
  startListener(fromBlockNumber?: number): void;
}

export interface IController {
  readonly network: BlockchainNetworks;
  readonly contractProvider: IContractProvider;

  start(): Promise<void>;
  syncBlocks(): Promise<void>;
  getLastCollectedBlock(): Promise<number>;
}

