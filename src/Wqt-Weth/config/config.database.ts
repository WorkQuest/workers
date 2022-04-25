import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.WqtWeth' });

export default {
  dbLink: process.env.DB_LINK,
};
