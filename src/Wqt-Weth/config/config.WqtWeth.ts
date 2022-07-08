import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.WqtWeth' });

export default {
  logLevel: 'debug',
  oracleLink: process.env.ORACLE_LINK,
  rpcProvider: process.env.ETH_MAIN_NETWORK_RPC_PROVIDER,
  wsProvider: process.env.ETH_MAIN_NETWORK_WEBSOCKET_PROVIDER,
};
