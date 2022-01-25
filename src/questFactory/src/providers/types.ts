import Web3 from "web3";
import {EventData} from "web3-eth-contract";

export type onEventCallBack = {
  (eventData): void;
}

export interface Web3Provider {
  web3: Web3;

  startListener(): Promise<void>;
  subscribeOnEvents(onEventCallBack: onEventCallBack): void;
  getAllEvents(fromBlockNumber: number): Promise<{ collectedEvents: EventData[], isGotAllEvents: boolean }>;
}
