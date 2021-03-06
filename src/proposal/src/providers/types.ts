import {TransactionBroker} from "../../../brokers/src/TransactionBroker";
import { Clients } from '../../../types';

export interface ProposalClients extends Clients {
  readonly transactionsBroker: TransactionBroker;
}

export * from '../../../types';
