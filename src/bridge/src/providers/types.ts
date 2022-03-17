import Web3 from 'web3';
import { EventData, Contract } from 'web3-eth-contract';
import { WebsocketClient as TendermintWebsocketClient } from "@cosmjs/tendermint-rpc";

export type onEventCallBack = {
  (eventData): void;
};

export interface Clients {
  readonly web3: Web3;
  readonly webSocketProvider?: any;
  readonly tendermintWsClient?: TendermintWebsocketClient;
}

export interface IContractProvider {
  readonly clients: Clients;
  readonly contract: Contract;

  startListener();
  subscribeOnEvents(onEventCallBack: onEventCallBack): void;
  getAllEvents(fromBlockNumber: number): Promise<{ collectedEvents: EventData[]; isGotAllEvents: boolean, lastBlockNumber: number }>;
}
