import { Clients } from '../../../types';
import { TransactionBroker } from "../../../brokers/src/TransactionBroker";

export interface ReferralClients extends Clients {
  readonly transactionsBroker: TransactionBroker;
}

export * from '../../../types';
