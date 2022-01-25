import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.pensionFund' });

export default {
  wsProvider: process.env.PENSION_FUND_WEBSOCKET_PROVIDER,
  contractAddress: process.env.PENSION_FUND_CONTRACT_ADDRESS,
  parseEventsFromHeight: parseInt(process.env.PENSION_FUND_PARSE_EVENTS_FROM_HEIGHT), // 176661
};
