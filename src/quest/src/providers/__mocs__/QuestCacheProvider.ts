import {IQuestCacheProvider, QuestPayload} from "../types";

export class QuestCacheProvider implements IQuestCacheProvider {

  public readonly contracts: Map<string, QuestPayload> = new Map<string, QuestPayload>();

  public async get(questContactAddress: string): Promise<QuestPayload | null> {
    return this.contracts.get(questContactAddress.toLowerCase());
  }

  public set(questContactAddress: string, payload: QuestPayload) {
    return void this.contracts.set(questContactAddress.toLowerCase(), payload);
  }
}
