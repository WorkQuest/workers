import { EventData } from 'web3-eth-contract';
import Web3 from 'web3';

export type onEventCallBack = {
  (eventData): void;
};

export interface Web3Provider {
  web3: Web3;

  startListener();
  subscribeOnEvents(onEventCallBack: onEventCallBack): void;
  getAllEvents(fromBlockNumber: number): Promise<{ collectedEvents: EventData[]; isGotAllEvents: boolean, lastBlockNumber: number }>;
}
