import { Clients, IContractCacheProvider } from '../../../types';
import { TransactionBroker } from "../../../brokers/src/TransactionBroker";
import { NotificationBroker } from "../../../brokers/src/NotificationBroker";

export type QuestPayload = {
  nonce: string;
  transactionHash: string;
}

export interface IQuestCacheProvider extends IContractCacheProvider<QuestPayload> {

}

export interface QuestClients extends Clients {
  readonly questCacheProvider: IQuestCacheProvider;
  readonly transactionsBroker: TransactionBroker;
  readonly notificationsBroker: NotificationBroker;
}

export * from '../../../types';


