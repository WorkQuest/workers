import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.referral' });

export default {
  dbLink: process.env.DB_LINK,
  notificationMessageBroker: {
    link: process.env.NOTIFICATION_MESSAGE_BROKER_LINK,
  },
  mqLink: process.env.RABBIT_LINK
};
