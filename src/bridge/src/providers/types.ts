import { TransactionBroker } from "../../../brokers/src/TransactionBroker";
import { IContractProvider, onEventCallBack, Clients } from '../../../types';

export interface BridgeClients extends Clients {
  readonly webSocketProvider: any;
}

export interface BridgeWorkNetClients extends Clients {
  readonly transactionsBroker: TransactionBroker;
}

export * from  '../../../types';
