import {ReceivedEvents} from "./contract-providers.types";
import {BlocksRange} from "../utilis/utilits.types";

export interface IContractProvider {
  readonly eventViewingHeight: number;

  getEvents(blocksRange: BlocksRange, callback: (events: ReceivedEvents) => void): Promise<void>;
}

export interface IContractListenerProvider extends IContractProvider {
  on(type: 'close', callback: () => void);
  on(type: 'error', callback: (error) => void);
  on(type: 'events', callback: (eventData) => void);

  startListener(fromBlockNumber?: number): void;
}
