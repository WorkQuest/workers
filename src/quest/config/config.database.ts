import {config} from "dotenv";

config({ path: __dirname +  '/../../../.env.quest'});

export default {
  dbLink: process.env.DB_LINK,
  redis: {
    port: parseInt(process.env.REDIS_PORT) || 6379,
    host: process.env.REDIS_HOST || '127.0.0.1',
    password: process.env.REDIS_PASSWORD,
    number: {
      workQuestDevNetwork: 0,
      workQuestTestNetwork: 1,
      workQuestMainNetwork: 2,
    },
    defaultConfigNetwork: (): { number: number, port: number, host: string, password: string } => {
      return {
        // @ts-ignore
        number: this.default.redis.number[process.env.BLOCKCHAIN_NETWORK],
        // @ts-ignore
        port: this.default.redis.port,
        // @ts-ignore
        host: this.default.redis.host,
        // @ts-ignore
        password: this.default.redis.password
      }
    }
  }
}

