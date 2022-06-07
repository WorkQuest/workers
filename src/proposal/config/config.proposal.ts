import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.proposal' });

export default {
  logLevel: 'debug',
  /** workQuestDevNetwork, workQuestTestNetwork, workQuestMainNetwork */
  network: process.env.WORK_QUEST_BLOCKCHAIN_NETWORK,
  workQuestDevNetwork: {
    linkRpcProvider: process.env.WORK_QUEST_DEV_NETWORK_RPC_PROVIDER,
    linkTendermintProvider: process.env.WORK_QUEST_DEV_NETWORK_TENDERMINT_PROVIDER,
  },
  workQuestTestNetwork: {
  },
  workQuestMainNetwork: {
  },
  defaultConfigNetwork: (): { linkTendermintProvider: string, linkRpcProvider: string } => {
    // @ts-ignore
    return this.default[this.default.network];
  },
}
