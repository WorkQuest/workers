import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.bridgeUsdt' });

export default {
  logLevel: 'debug',

  network: () => {
    const networkArg = process.argv
      .find(argv => argv.includes("--network="))

    return networkArg
      ? networkArg.replace("--network=", "")
      : undefined
  },

  privateKey: process.env.SWAP_USDT_CONTRACT_PRIVATE_KEY,

  accountSenderFirsWqt: {
    address: process.env.ACCOUNT_ADDRESS_TO_SEND_FIRST_WQT,
    privateKey: process.env.ACCOUNT_PRIVATE_KEY_TO_SEND_FIRST_WQT,
  },
  workQuestTestNetwork: {
    linkRpcProvider: process.env.WORK_QUEST_TEST_NETWORK_RPC_PROVIDER,
  },
  workQuestMainNetwork: {
    linkRpcProvider: process.env.WORK_QUEST_MAIN_NETWORK_RPC_PROVIDER,
  },
  workQuestDevNetwork: {
    linkRpcProvider: process.env.WORK_QUEST_DEV_NETWORK_RPC_PROVIDER,
  },
  ethereumMainNetwork: {
    linkRpcProvider: process.env.ETH_MAIN_NETWORK_RPC_PROVIDER,
    linkWsProvider: process.env.ETH_MAIN_NETWORK_WEBSOCKET_PROVIDER,
  },
  bscMainNetwork: {
    linkRpcProvider: process.env.BSC_MAIN_NETWORK_RPC_PROVIDER,
    linkWsProvider: process.env.BSC_MAIN_NETWORK_WEBSOCKET_PROVIDER,
  },
  rinkebyTestNetwork: {
    linkRpcProvider: process.env.RINKEBY_TEST_NETWORK_RPC_PROVIDER,
    linkWsProvider: process.env.RINKEBY_TEST_NETWORK_WEBSOCKET_PROVIDER,
  },
  bscTestNetwork: {
    linkRpcProvider: process.env.BSC_TEST_NETWORK_RPC_PROVIDER,
    linkWsProvider: process.env.BSC_TEST_NETWORK_WEBSOCKET_PROVIDER,
  },
  polygonMainNetwork: {
    linkRpcProvider: process.env.POLYGON_MAIN_NETWORK_RPC_PROVIDER,
    linkWsProvider: process.env.POLYGON_MAIN_NETWORK_WEBSOCKET_PROVIDER,
  },
  mumbaiTestNetwork: {
    linkRpcProvider: process.env.MUMBAI_TEST_NETWORK_RPC_PROVIDER,
    linkWsProvider: process.env.MUMBAI_TEST_NETWORK_WEBSOCKET_PROVIDER,
  },

  configForNetwork: (): { linkRpcProvider: string, linkWsProvider?: string } => {
    // @ts-ignore
    return this.default[this.default.network()];
  },
};
