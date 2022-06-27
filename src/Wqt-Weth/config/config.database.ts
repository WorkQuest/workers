import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.WqtWeth' });

export default {
  dbLink: process.env.DB_LINK,
  notificationMessageBroker: process.env.NOTIFICATION_MESSAGE_BROKER_LINK,
};
