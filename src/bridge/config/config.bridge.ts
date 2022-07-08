import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.bridge' });

export default {
  logLevel: 'debug',
  workQuestNetwork: process.env.WORK_QUEST_BLOCKCHAIN_NETWORK, // workQuestDevNetwork, workQuestTestNetwork, workQuestMainNetwork
  bscNetwork: process.env.BSC_BLOCKCHAIN_NETWORK, // bscMainNetwork, bscTestNetwork
  ethereumNetwork: process.env.ETHEREUM_BLOCKCHAIN_NETWORK, // ethereumMainNetwork, rinkebyTestNetwork

  workQuestDevNetwork: {
    linkTendermintProvider: process.env.WORK_QUEST_DEV_NETWORK_TENDERMINT_PROVIDER,
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
    contractAddress: process.env.BSC_TEST_NETWORK_BRIDGE_CONTRACT_ADDRESS,
    linkRpcProvider: process.env.BSC_TEST_NETWORK_RPC_PROVIDER,
    linkWsProvider: process.env.BSC_TEST_NETWORK_WEBSOCKET_PROVIDER,
  },
  defaultWqConfigNetwork: (): { linkRpcProvider: string } => {
    // @ts-ignore
    return this.default[this.default.workQuestNetwork];
  },
  defaultBscConfigNetwork: (): { linkWsProvider: string, linkRpcProvider: string } => {
    // @ts-ignore
    return this.default[this.default.bscNetwork];
  },
  defaultEthConfigNetwork: (): { linkWsProvider: string, linkRpcProvider: string } => {
    // @ts-ignore
    return this.default[this.default.ethereumNetwork];
  },
  privateKey: process.env.BRIDGE_CONTRACT_PRIVATE_KEY,
};
