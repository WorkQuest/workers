import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.referral' });

export default {
  workQuestDevNetwork: {
    rpcProvider: process.env.WORK_QUEST_DEV_NETWORK_RPC_PROVIDER,
    tendermintProvider: process.env.WORK_QUEST_DEV_NETWORK_TENDERMINT_PROVIDER,
    contractAddress: process.env.WORK_QUEST_DEV_NETWORK_REFERRAL_CONTRACT_ADDRESS,
    parseEventsFromHeight: parseInt(process.env.WORK_QUEST_DEV_NETWORK_REFERRAL_PARSE_EVENTS_FROM_HEIGHT),
  }
};
