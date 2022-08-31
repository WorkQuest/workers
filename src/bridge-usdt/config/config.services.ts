import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.bridgeUsdt' });

export default {
  oracleLink: process.env.ORACLE_LINK,
  database: { postgresLink: process.env.DB_LINK },
  messageOriented: {
    notificationMessageBrokerLink: process.env.NOTIFICATION_MESSAGE_BROKER_LINK,
    routerClientMessageBrokerLink: process.env.ROUTER_CLIENT_MESSAGE_BROKER_LINK,
  },
};
