import { Clients } from '../../../types';
import { TransactionBroker } from "../../../brokers/src/TransactionBroker";
import { NotificationBroker } from "../../../brokers/src/NotificationBroker";

export interface PensionFundClients extends Clients {
  readonly transactionsBroker: TransactionBroker;
  readonly notificationsBroker: NotificationBroker;
}

export * from '../../../types';
