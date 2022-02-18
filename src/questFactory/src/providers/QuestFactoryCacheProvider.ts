import { ICacheProvider, QuestPayload } from "./types";
import { RedisClusterType } from "@node-redis/client";

export class QuestFactoryCacheProvider implements ICacheProvider {
  constructor(
    public readonly client: RedisClusterType,
  ) {}

  public get(questContactAddress: string) {
    return this.client.get(questContactAddress);
  }

  public set(questContactAddress: string, payload: QuestPayload) {
    return this.client.set(questContactAddress, JSON.stringify(payload));
  }
}
