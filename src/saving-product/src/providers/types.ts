import { Clients } from "../../../types";
import { TransactionBroker } from "../../../middleware/src/TransactionBroker";

export interface SavingProductClients extends Clients {
  readonly transactionsBroker: TransactionBroker;
}

export * from "../../../types";



