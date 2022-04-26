import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.pensionFund' });

export default {
  logLevel: 'debug',
  network: process.env.WORK_QUEST_BLOCKCHAIN_NETWORK, // workQuestDevNetwork, workQuestTestNetwork, workQuestMainNetwork
  workQuestDevNetwork: {
    contractAddress: process.env.WORK_QUEST_DEV_NETWORK_PENSION_FUND_CONTRACT_ADDRESS,
    linkRpcProvider: process.env.WORK_QUEST_DEV_NETWORK_RPC_PROVIDER,
    parseEventsFromHeight: parseInt(process.env.WORK_QUEST_DEV_NETWORK_PENSION_FUND_PARSE_EVENTS_FROM_HEIGHT),
  },
  workQuestTestNetwork: {
  },
  workQuestMainNetwork: {
  },
  defaultConfigNetwork: (): { contractAddress: string, linkRpcProvider: string, parseEventsFromHeight: number } => {
    // @ts-ignore
    return this.default[this.default.network];
  },
};
