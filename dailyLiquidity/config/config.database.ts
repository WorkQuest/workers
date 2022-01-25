import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.liquidity' });

export default {
  dbLink: process.env.DB_LINK,
};
