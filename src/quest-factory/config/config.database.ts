import {config} from "dotenv";

config({ path: __dirname +  '/../../../.env.questFactory'});

export default {
  dbLink: process.env.DB_LINK,
  mqLink: process.env.RABBIT_LINK,
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
        number: this.default.redis.number[process.env.BLOCKCHAIN_NETWORK],
        // @ts-ignore
        url: this.default.redis.url
      }
    }
  }
}

