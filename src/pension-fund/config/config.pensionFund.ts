import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.pensionFund' });

export default {
  logLevel: 'debug',
  /** workQuestDevNetwork, workQuestTestNetwork, workQuestMainNetwork */
  network: process.env.WORK_QUEST_BLOCKCHAIN_NETWORK,
  workQuestDevNetwork: {
    linkRpcProvider: process.env.WORK_QUEST_DEV_NETWORK_RPC_PROVIDER,
  },
  workQuestTestNetwork: {
  },
  workQuestMainNetwork: {
    linkRpcProvider: process.env.WORK_QUEST_MAIN_NETWORK_RPC_PROVIDER,
  },
  defaultConfigNetwork: (): { linkRpcProvider: string } => {
    // @ts-ignore
    return this.default[this.default.network];
  },
};
