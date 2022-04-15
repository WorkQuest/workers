import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.WqtWeth' });

export default {
  logLevel: 'debug',
  oracleLink: process.env.ORACLE_LINK,
  wsProvider: process.env.WQT_WETH_WEBSOCKET_PROVIDER,
  contractAddress: process.env.WQT_WETH_CONTRACT_ADDRESS,
  parseEventsFromHeight: parseInt(process.env.WQT_WETH_PARSE_EVENTS_FROM_HEIGHT)
};
