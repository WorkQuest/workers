import { Clients } from '../../../types';
import { TransactionBroker } from "../../../brokers/src/TransactionBroker";

export interface PensionFundClients extends Clients {
  readonly transactionsBroker: TransactionBroker;
}

export * from '../../../types';
