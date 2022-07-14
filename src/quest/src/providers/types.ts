import {IContractCacheProvider} from '../../../types';

export type QuestPayload = {
  nonce: string;
  transactionHash: string;
}

export interface IQuestCacheProvider extends IContractCacheProvider<QuestPayload> {

}

export * from '../../../types';


