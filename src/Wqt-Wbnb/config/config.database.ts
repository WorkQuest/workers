import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.Wqt-Wbnb' });

export default {
  dbLink: process.env.DB_LINK,
};
