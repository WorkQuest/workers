import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.pensionFund' });

export default {
  dbLink: process.env.DB_LINK,
  mqLink: process.env.RABBIT_LINK,
  notificationMessageBrokerLink: process.env.NOTIFICATION_MESSAGE_BROKER_LINK,
};
