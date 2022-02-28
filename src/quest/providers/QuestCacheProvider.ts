import { IQuestCacheProvider, QuestPayload } from "./types";
import { RedisClusterType } from "@node-redis/client";

export class QuestCacheProvider implements IQuestCacheProvider {
  constructor(
    public readonly client: RedisClusterType,
  ) {}

  public async get(questContactAddress: string): Promise<QuestPayload | null> {
    return JSON.parse(await this.client.get(questContactAddress.toLowerCase()));
  }

  public set(questContactAddress: string, payload: QuestPayload) {
    return this.client.set(questContactAddress.toLowerCase(), JSON.stringify(payload));
  }
}
