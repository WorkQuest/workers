import {ReceivedEvents} from "./types";
import {BlockchainNetworks} from "@workquest/database-models/lib/models";

export interface ILogger {
  warn(log: string, ...payload: any[]);
  info(log: string, ...payload: any[]);
  debug(log: string, ...payload: any[]);
  error(error: any, log, ...payload: any[]);
}

export interface IController {
  readonly network: BlockchainNetworks;
  readonly contractProvider: IContractProvider;

  start(): Promise<void>;
  syncBlocks(): Promise<void>;
  getLastCollectedBlock(): Promise<number>;
}

export interface IContractProvider {
  readonly eventViewingHeight: number;

  getEvents(fromBlockNumber: number): Promise<ReceivedEvents>;
}

export interface IContractListenerProvider extends IContractProvider {
  on(type: 'error', callback: (error) => void);
  on(type: 'events', callback: (eventData) => void);

  startListener(fromBlockNumber?: number): void;
}
