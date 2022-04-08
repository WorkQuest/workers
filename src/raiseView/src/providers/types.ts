import { IContractProvider, onEventCallBack, Clients, IContractCacheProvider } from '../../../types';
import {WebsocketClient as TendermintWebsocketClient} from "@cosmjs/tendermint-rpc/build/rpcclients/websocketclient";
import { TransactionBroker } from "../../../brokers/src/TransactionBroker";

export interface RaiseViewClients extends Clients {
  readonly tendermintWsClient?: TendermintWebsocketClient;
  readonly transactionsBroker?: TransactionBroker;
}

export {
  onEventCallBack,
  IContractProvider,
}

