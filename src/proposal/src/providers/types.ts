import {TransactionBroker} from "../../../brokers/src/TransactionBroker";
import { Clients } from '../../../types';
import { NotificationBroker } from "../../../brokers/src/NotificationBroker";

export interface ProposalClients extends Clients {
  readonly transactionsBroker: TransactionBroker;
  readonly notificationsBroker: NotificationBroker;
}

export * from '../../../types';
