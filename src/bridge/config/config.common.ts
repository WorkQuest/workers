import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.bridge' });

export default {
  database: {
    link: process.env.DB_LINK,
  },
  notificationMessageBroker: {
    link: process.env.NOTIFICATION_MESSAGE_BROKER_LINK,
  },
};
