import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.routerServer' });

export default {
  database: {
    postgresLink: process.env.DB_LINK,
    redis: {
      number: 0,
      url: process.env.REDIS_LINK,
    },
  },
  messageOriented: {
    routerServerMessageBrokerLink: process.env.ROUTER_SERVER_MESSAGE_BROKER_LINK,
  },
};
