import { Clients } from '../../../types';
import { TransactionBroker } from "../../../brokers/src/TransactionBroker";
import { NotificationBroker } from "../../../brokers/src/NotificationBroker";

export interface ReferralClients extends Clients {
  readonly transactionsBroker: TransactionBroker;
  readonly notificationsBroker: NotificationBroker;
}

export * from '../../../types';
