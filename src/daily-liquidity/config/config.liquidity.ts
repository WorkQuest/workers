import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.liquidity' });

export default {
  logLevel: 'debug',
  contractAddress: process.env.DAILY_LIQUIDITY_CONTRACT_ADDRESS,
  wsProvider: process.env.DAILY_LIQUIDITY_WEBSOCKET_PROVIDER,
};
