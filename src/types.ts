import Web3 from "web3";
import {EventData} from "web3-eth-contract";
import {BlockchainNetworks} from "@workquest/database-models/lib/models";
import {Logger} from "./bridge/logger/pino";
import configBridge from "./bridge/config/config.bridge";

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

export interface ILogger {
  warn(log: string, ...payload: any[]);
  info(log: string, ...payload: any[]);
  debug(log: string, ...payload: any[]);
  error(error: any, log, ...payload: any[]);
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

