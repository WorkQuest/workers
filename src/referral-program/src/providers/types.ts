import { Clients } from '../../../types';
import { TransactionBroker } from "../../../brokers/src/TransactionBroker";
import { NotificationBroker } from "../../../brokers/src/NotificationBroker";
import { CommunicationBroker } from "../../../brokers/src/CommunicationBroker";

export interface ReferralClients extends Clients {
  readonly transactionsBroker: TransactionBroker;
  readonly notificationsBroker: NotificationBroker;
  readonly communicationBroker: CommunicationBroker;
}

export * from '../../../types';
