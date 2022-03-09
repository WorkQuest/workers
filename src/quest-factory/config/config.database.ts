import {config} from "dotenv";

config({ path: __dirname +  '/../../../.env.quest-factory'});

export default {
  dbLink: process.env.DB_LINK,
  redis: {
    url: process.env.REDIS_LINK,
    number: {
      workQuestDevNetwork: 0,
      workQuestTestNetwork: 1,
      workQuestMainNetwork: 2,
    },
    defaultConfigNetwork: (): { url: string, number: number } => {
      return {
        // @ts-ignore
        number: this.default.redis[process.env.QUEST_FACTORY_NETWORK],
        // @ts-ignore
        url: this.default.redis.url
      }
    }
  }
}

