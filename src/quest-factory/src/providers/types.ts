import { Clients } from '../../../types';
import {IQuestCacheProvider} from '../../../quest/src/providers/types'
import { TransactionBroker } from "../../../middleware/src/TransactionBroker";
import { NotificationBroker } from "../../../middleware/src/NotificationBroker";

export interface QuestFactoryClients extends Clients {
  readonly questCacheProvider: IQuestCacheProvider;
  readonly transactionsBroker?: TransactionBroker;
  readonly notificationsBroker?: NotificationBroker;
}

export * from '../../../types';

