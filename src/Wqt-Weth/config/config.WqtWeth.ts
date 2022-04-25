import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.WqtWeth' });

export default {
  logLevel: 'debug',
  oracleLink: process.env.ORACLE_LINK,
  contractAddress: process.env.WQT_WETH_CONTRACT_ADDRESS,
  wsProvider: process.env.ETH_MAIN_NETWORK_WEBSOCKET_PROVIDER,
  parseEventsFromHeight: parseInt(process.env.WQT_WETH_PARSE_EVENTS_FROM_HEIGHT)
};
