import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.routerServer' });

export default {
  logLevel: 'debug',

  network: () => {
    const networkArg = process.argv
      .find(s => s.match(/--network=/g))

    return networkArg
      ? networkArg.replace("--network=", "")
      : undefined
  },

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

  configForNetwork: (): { linkRpcProvider: string } => {
    // @ts-ignore
    return this.default[this.default.network()];
  },
}
