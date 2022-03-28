import Web3 from "web3";
import {Contract, EventData} from "web3-eth-contract";
import {IQuestCacheProvider} from '../../../quest/src/providers/types'
import {WebsocketClient as TendermintWebsocketClient} from "@cosmjs/tendermint-rpc/build/rpcclients/websocketclient";

export type onEventCallBack = {
  (eventData): Promise<void>;
}

export interface Clients {
  readonly web3: Web3;
  readonly questCacheProvider: IQuestCacheProvider;
  readonly tendermintWsClient?: TendermintWebsocketClient;
}

export interface IContractProvider {
  readonly clients: Clients;
  readonly contract: Contract;

  startListener();
  subscribeOnEvents(onEventCallBack: onEventCallBack): void;
  getAllEvents(fromBlockNumber: number): Promise<{ collectedEvents: EventData[], isGotAllEvents: boolean }>;
}
