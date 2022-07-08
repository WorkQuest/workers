import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.WqtWbnb' });

export default {
  logLevel: 'debug',
  oracleLink: process.env.ORACLE_LINK,
  rpcProvider: process.env.BSC_MAIN_NETWORK_RPC_PROVIDER,
  wsProvider: process.env.BSC_MAIN_NETWORK_WEBSOCKET_PROVIDER,
};
