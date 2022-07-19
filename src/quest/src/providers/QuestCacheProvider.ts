import {IQuestCacheProvider, QuestPayload} from "./types";
import {KeyValueRedisRepository} from "../../../middleware";

export class QuestCacheProvider extends KeyValueRedisRepository<QuestPayload> implements IQuestCacheProvider {
  constructor(
    protected readonly redisClientOptions: { number: number, url: string },
  ) {
    super(redisClientOptions);
  }

  public async get(questContactAddress: string): Promise<QuestPayload | null> {
    return JSON.parse(await this.redisClient.get(questContactAddress.toLowerCase()));
  }

  public async set(questContactAddress: string, payload: QuestPayload) {
    await this.redisClient.set(questContactAddress.toLowerCase(), JSON.stringify({ name: 'quest', ...payload }));
  }

  public async remove(questContactAddress: string) {
    await this.redisClient.del(questContactAddress);
  }
}
