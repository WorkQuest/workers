import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.WqtWbnb' });

export default {
  logLevel: 'debug',
  oracleLink: process.env.ORACLE_LINK,
  wsProvider: process.env.BSC_MAIN_NETWORK_WEBSOCKET_PROVIDER,
};
