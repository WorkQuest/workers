import { Clients } from '../../../types';
import {IQuestCacheProvider} from '../../../quest/src/providers/types'
import { TransactionBroker } from "../../../brokers/src/TransactionBroker";

export interface QuestFactoryClients extends Clients {
  readonly questCacheProvider: IQuestCacheProvider;
  readonly transactionsBroker?: TransactionBroker;
}

export * from '../../../types';

