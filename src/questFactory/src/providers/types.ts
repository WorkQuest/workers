import Web3 from "web3";
import {EventData} from "web3-eth-contract";

export type onEventCallBack = {
  (eventData): void;
}

export type QuestPayload = {
  nonce: string;
  transactionHash: string;
}

export interface ICacheProvider {
  get(questContactAddress: string): Promise<string>;
  set(questContactAddress: string, payload: QuestPayload): Promise<string>;
}

export interface IContractProvider {
  web3: Web3;

  startListener(): Promise<void>;
  subscribeOnEvents(onEventCallBack: onEventCallBack): void;
  getAllEvents(fromBlockNumber: number): Promise<{ collectedEvents: EventData[], isGotAllEvents: boolean }>;
}
