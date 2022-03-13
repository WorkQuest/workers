import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.WqtWbnb' });

export default {
  dbLink: process.env.DB_LINK,
};
