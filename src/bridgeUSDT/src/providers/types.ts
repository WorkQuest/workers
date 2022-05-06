import { TransactionBroker } from "../../../brokers/src/TransactionBroker";
import { Clients } from '../../../types';
import { NotificationBroker } from "../../../brokers/src/NotificationBroker";

export interface BridgeUSDTClients extends Clients {
  readonly notificationsBroker: NotificationBroker;
}

export interface BridgeUSDTWorkNetClients extends BridgeUSDTClients {
  readonly transactionsBroker: TransactionBroker;
}

export interface BridgeUSDTEthClients extends BridgeUSDTClients {
  readonly webSocketProvider: any;
}

export * from  '../../../types';
