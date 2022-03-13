import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.referral-program' });

export default {
  dbLink: process.env.DB_LINK,
  notificationMessageBroker: {
    link: process.env.NOTIFICATION_MESSAGE_BROKER_LINK,
  }
};
