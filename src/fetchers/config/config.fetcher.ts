import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.fetcher' });

export default {
  network: process.env.BLOCKCHAIN_NETWORK, // workQuestDevNetwork, workQuestTestNetwork, workQuestMainNetwork
  workQuestDevNetwork: {
    linkRpcProvider: process.env.WORK_QUEST_DEV_NETWORK_RPC_PROVIDER,
    linkMessageBroker: process.env.RABBIT_LINK,
  },

  defaultConfigNetwork: (): {
    linkRpcProvider: string,
    linkMessageBroker: string,
  } => {
    // @ts-ignore
    return this.default[this.default.network];
  },
}
