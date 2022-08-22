import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.fetcher' });

export default {
  logLevel: 'debug',
  redis: {
    number: 0,
    url: process.env.REDIS_LINK,
  },
  rabbitLink: process.env.RABBIT_LINK,
  network: process.env.WORK_QUEST_BLOCKCHAIN_NETWORK, // workQuestDevNetwork, workQuestTestNetwork, workQuestMainNetwork
  routerServerMessageBrokerLink: process.env.ROUTER_SERVER_MESSAGE_BROKER_LINK,

  workQuestDevNetwork: {
    linkRpcProvider: process.env.WORK_QUEST_DEV_NETWORK_RPC_PROVIDER,
  },
  workQuestTestNetwork: {
    linkRpcProvider: process.env.WORK_QUEST_TEST_NETWORK_RPC_PROVIDER,
  },
  workQuestMainNetwork: {
    linkRpcProvider: process.env.WORK_QUEST_MAIN_NETWORK_RPC_PROVIDER,
  },
  ethereumMainNetwork: {
    linkRpcProvider: process.env.ETH_MAIN_NETWORK_RPC_PROVIDER,
  },
  bscMainNetwork: {
    linkRpcProvider: process.env.BSC_MAIN_NETWORK_RPC_PROVIDER,
  },
  rinkebyTestNetwork: {
    linkRpcProvider: process.env.RINKEBY_TEST_NETWORK_RPC_PROVIDER,
  },
  bscTestNetwork: {
    linkRpcProvider: process.env.BSC_TEST_NETWORK_RPC_PROVIDER,
  },

  defaultConfigNetwork: (): { linkRpcProvider: string } => {
    // @ts-ignore
    return this.default[this.default.network];
  },
}
