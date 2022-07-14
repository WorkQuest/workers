import { Clients } from '../../../types';
import { TransactionBroker } from "../../../middleware/src/TransactionBroker";
import { NotificationBroker } from "../../../middleware/src/NotificationBroker";
import { CommunicationBroker } from "../../../middleware/src/CommunicationBroker";

export interface ReferralClients extends Clients {
  readonly transactionsBroker: TransactionBroker;
  readonly notificationsBroker: NotificationBroker;
  readonly communicationBroker: CommunicationBroker;
}

export * from '../../../types';
