import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.referral' });

export default {
  logLevel: 'debug',
  network: process.env.WORK_QUEST_BLOCKCHAIN_NETWORK, // workQuestDevNetwork, workQuestTestNetwork, workQuestMainNetwork
  workQuestDevNetwork: {
    linkRpcProvider: process.env.WORK_QUEST_DEV_NETWORK_RPC_PROVIDER,
    linkTendermintProvider: process.env.WORK_QUEST_DEV_NETWORK_TENDERMINT_PROVIDER,
  },
  defaultConfigNetwork: (): { linkTendermintProvider: string, linkRpcProvider: string } => {
    // @ts-ignore
    return this.default[this.default.network];
  },
};
