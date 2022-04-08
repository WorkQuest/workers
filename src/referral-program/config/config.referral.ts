import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.referral' });

export default {
  logLevel: 'debug',
  network: process.env.BLOCKCHAIN_NETWORK, // workQuestDevNetwork, workQuestTestNetwork, workQuestMainNetwork
  workQuestDevNetwork: {
    linkRpcProvider: process.env.WORK_QUEST_DEV_NETWORK_RPC_PROVIDER,
    linkTendermintProvider: process.env.WORK_QUEST_DEV_NETWORK_TENDERMINT_PROVIDER,
    contractAddress: process.env.WORK_QUEST_DEV_NETWORK_REFERRAL_CONTRACT_ADDRESS,
    parseEventsFromHeight: parseInt(process.env.WORK_QUEST_DEV_NETWORK_REFERRAL_PARSE_EVENTS_FROM_HEIGHT),
  },
  defaultConfigNetwork: (): { contractAddress: string, linkTendermintProvider: string, linkRpcProvider: string, parseEventsFromHeight: number } => {
    // @ts-ignore
    return this.default[this.default.network];
  },
};
