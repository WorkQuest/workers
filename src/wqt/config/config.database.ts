import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.wqt' });

export default {
  dbLink: process.env.DB_LINK,
};
