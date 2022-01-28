import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.pensionFund' });

export default {
  contractAddress: process.env.PENSION_FUND_CONTRACT_ADDRESS,
  wsProvider: process.env.WORK_QUEST_DEV_NETWORK_WEBSOCKET_PROVIDER,
  parseEventsFromHeight: parseInt(process.env.PENSION_FUND_PARSE_EVENTS_FROM_HEIGHT),
};
