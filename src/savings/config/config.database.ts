import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.savings' });

export default {
  dbLink: process.env.DB_LINK,
  mqLink: process.env.RABBIT_LINK
};
