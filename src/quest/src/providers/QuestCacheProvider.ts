import { RedisClusterType } from "@node-redis/client";
import { IQuestCacheProvider, QuestPayload } from "./types";

export class QuestCacheProvider implements IQuestCacheProvider {
  constructor(
    public readonly client: RedisClusterType,
  ) {}

  public async get(questContactAddress: string): Promise<QuestPayload | null> {
    return JSON.parse(await this.client.get(questContactAddress.toLowerCase()));
  }

  public async set(questContactAddress: string, payload: QuestPayload) {
    await this.client.set(questContactAddress.toLowerCase(), JSON.stringify({ name: 'quest', ...payload }));
  }

  public async remove(questContactAddress: string) {
    await this.client.del(questContactAddress);
  }
}
