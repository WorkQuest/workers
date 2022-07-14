import { Clients } from '../../../types';
import { TransactionBroker } from "../../../middleware/src/TransactionBroker";

export interface RaiseViewClients extends Clients {
  readonly transactionsBroker: TransactionBroker;
}

export * from '../../../types';

