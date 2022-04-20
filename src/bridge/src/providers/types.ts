import { TransactionBroker } from "../../../brokers/src/TransactionBroker";
import { Clients } from '../../../types';
import { NotificationBroker } from "../../../brokers/src/NotificationBroker";

export interface BridgeClients extends Clients {
  readonly notificationsBroker: NotificationBroker;
}

export interface BridgeWorkNetClients extends BridgeClients {
  readonly transactionsBroker: TransactionBroker;
}

export interface BridgeEthClients extends BridgeClients {
  readonly webSocketProvider: any;
}

export * from  '../../../types';
