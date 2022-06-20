import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.bridge' });

export default {
  logLevel: 'debug',
  workQuestNetwork: process.env.WORK_QUEST_BLOCKCHAIN_NETWORK, // workQuestDevNetwork, workQuestTestNetwork, workQuestMainNetwork
  bscNetwork: 'bscMainNetwork', // bscMainNetwork, bscTestNetwork
  ethereumNetwork: 'ethereumMainNetwork', // ethereumMainNetwork, rinkebyTestNetwork

  workQuestDevNetwork: {
    linkTendermintProvider: process.env.WORK_QUEST_DEV_NETWORK_TENDERMINT_PROVIDER,
    linkRpcProvider: process.env.WORK_QUEST_DEV_NETWORK_RPC_PROVIDER,
  },
  workQuestTestNetwork: {
    linkTendermintProvider: process.env.WORK_QUEST_TEST_NETWORK_TENDERMINT_PROVIDER,
    linkRpcProvider: process.env.WORK_QUEST_TEST_NETWORK_RPC_PROVIDER,
  },
  workQuestMainNetwork: {
  },
  ethereumMainNetwork: {
    linkWsProvider: process.env.ETH_MAIN_NETWORK_WEBSOCKET_PROVIDER,
  },
  bscMainNetwork: {
    linkWsProvider: process.env.BSC_MAIN_NETWORK_WEBSOCKET_PROVIDER,
  },
  rinkebyTestNetwork: {
    linkWsProvider: process.env.RINKEBY_TEST_NETWORK_WEBSOCKET_PROVIDER,
  },
  bscTestNetwork: {
    contractAddress: process.env.BSC_TEST_NETWORK_BRIDGE_CONTRACT_ADDRESS,
    linkWsProvider: process.env.BSC_TEST_NETWORK_WEBSOCKET_PROVIDER,
  },
  defaultWqConfigNetwork: (): { linkTendermintProvider: string, linkRpcProvider: string } => {
    // @ts-ignore
    return this.default[this.default.workQuestNetwork];
  },
  defaultBscConfigNetwork: (): { linkWsProvider: string } => {
    // @ts-ignore
    return this.default[this.default.bscNetwork];
  },
  defaultEthConfigNetwork: (): { linkWsProvider: string } => {
    // @ts-ignore
    return this.default[this.default.ethereumNetwork];
  },
  privateKey: process.env.BRIDGE_CONTRACT_PRIVATE_KEY,
};
