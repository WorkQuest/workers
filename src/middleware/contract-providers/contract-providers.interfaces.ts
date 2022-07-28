import {ReceivedEvents} from "./contract-providers.types";

export interface IContractProvider {
  readonly eventViewingHeight: number;

  getEvents(fromBlockNumber: number, toBlockNumber: number | 'latest'): Promise<ReceivedEvents>;
}

export interface IContractListenerProvider extends IContractProvider {
  on(type: 'close', callback: () => void);
  on(type: 'error', callback: (error) => void);
  on(type: 'events', callback: (eventData) => void);

  startListener(fromBlockNumber?: number): void;
}
