import {IKeyValueRepository} from "../../../middleware";

export type QuestPayload = {
  nonce: string;
  transactionHash: string;
}

export interface IQuestCacheProvider extends IKeyValueRepository<QuestPayload> {
  remove(questAddress: string): Promise<void>;
  get(questAddress: string): Promise<QuestPayload | null>;
  set(questAddress: string, payload: QuestPayload): Promise<void>;
}

export * from '../../../types';


