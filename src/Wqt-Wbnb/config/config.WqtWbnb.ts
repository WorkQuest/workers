import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.WqtWbnb' });

export default {
  logLevel: 'debug',
  oracleLink: process.env.ORACLE_LINK,
  contractAddress: process.env.WQT_WBNB_CONTRACT_ADDRESS,
  wsProvider: process.env.BSC_MAIN_NETWORK_WEBSOCKET_PROVIDER,
  parseEventsFromHeight: parseInt(process.env.WQT_WBNB_PARSE_EVENTS_FROM_HEIGHT), // 11335760
};
