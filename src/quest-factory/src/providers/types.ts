import {IQuestCacheProvider} from '../../../quest/src/providers/types'
import { IContractProvider, onEventCallBack, Clients } from '../../../types';
import {WebsocketClient as TendermintWebsocketClient} from "@cosmjs/tendermint-rpc/build/rpcclients/websocketclient";
import { TransactionBroker } from "../../../brokers/src/TransactionBroker";

export interface QuestFactoryClients extends Clients {
  readonly questCacheProvider: IQuestCacheProvider;
  readonly tendermintWsClient?: TendermintWebsocketClient;
  readonly transactionsBroker?: TransactionBroker;
}

export {
  onEventCallBack,
  IContractProvider,
}

