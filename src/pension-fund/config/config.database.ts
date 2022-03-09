import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.pension-fund' });

export default {
  dbLink: process.env.DB_LINK,
};
