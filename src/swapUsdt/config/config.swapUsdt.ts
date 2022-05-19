import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.swapUsdt' });

export default {
  logLevel: 'debug',
  workQuestNetwork: process.env.WORK_QUEST_BLOCKCHAIN_NETWORK, // workQuestDevNetwork, workQuestTestNetwork, workQuestMainNetwork
  bscNetwork: process.env.BSC_BLOCKCHAIN_NETWORK, // bscMainNetwork, bscTestNetwork
  ethereumNetwork: process.env.ETHEREUM_BLOCKCHAIN_NETWORK, // ethereumMainNetwork, rinkebyTestNetwork
  polygonscanNetwork: process.env.POLYGONSCAN_BLOCKCHAIN_NETWORK,//polygonscanMainNetwork, mumbaiTestNetwork
  mnemonic: process.env.BRIDGE_USDT_MNEMONIC_WALLET_ADDRESS,
  wqtTokenContractAddress: process.env.WQT_TOKEN_CONTRACT_ADRESS,
  gasLimitWqtTransfer: process.env.GAS_LIMIT_TRANSFER_WQT,
  oracleLink: process.env.ORACLE_LINK,
  privateKey: process.env.SWAP_USDT_CONTRACT_PRIVATE_KEY,
  nodeRpcProvider:process.env.DEV_NODE_RPC_PROVIDER,
  workQuestDevNetwork: {
    contractAddress: process.env.WORK_QUEST_DEV_NETWORK_BRIDGE_CONTRACT_ADDRESS,
    linkTendermintProvider: process.env.WORK_QUEST_DEV_NETWORK_TENDERMINT_PROVIDER,
    linkRpcProvider: process.env.WORK_QUEST_DEV_NETWORK_RPC_PROVIDER,
    parseEventsFromHeight: parseInt(process.env.WORK_QUEST_DEV_NETWORK_BRIDGE_PARSE_EVENTS_FROM_HEIGHT) || 0,
  },
  workQuestTestNetwork: {},
  workQuestMainNetwork: {},
  ethereumMainNetwork: {
    parseEventsFromHeight: parseInt(process.env.BRIDGE_ETH_MAINNETWORK_PARSE_EVENTS_FROM_HEIGHT) || 0,
    contractAddress: process.env.BRIDGE_ETH_MAINNETWORK_CONTRACT_ADDRESS,
    linkWsProvider: process.env.BRIDGE_ETH_MAINNETWORK_WEBSOCKET_PROVIDER,
  },
  rinkebyTestNetwork: {
    parseEventsFromHeight: parseInt(process.env.RINKEBY_TEST_NETWORK_BRIDGE_PARSE_EVENTS_FROM_HEIGHT) || 0,
    contractAddress: process.env.RINKEBY_TEST_NETWORK_BRIDGE_CONTRACT_ADDRESS,
    linkWsProvider: process.env.RINKEBY_TEST_NETWORK_WEBSOCKET_PROVIDER,
  },
  bscMainNetwork: {
    parseEventsFromHeight: parseInt(process.env.BRIDGE_BSC_MAINNETWORK_PARSE_EVENTS_FROM_HEIGHT) || 0,
    contractAddress: process.env.BRIDGE_BSC_MAINNETWORK_CONTRACT_ADDRESS,
    linkWsProvider: process.env.BRIDGE_BSC_MAINNETWORK_WEBSOCKET_PROVIDER,
  },
  bscTestNetwork: {
    parseEventsFromHeight: parseInt(process.env.BSC_TEST_NETWORK_BRIDGE_PARSE_EVENTS_FROM_HEIGHT) || 0,
    contractAddress: process.env.BSC_TEST_NETWORK_BRIDGE_CONTRACT_ADDRESS,
    linkWsProvider: process.env.BSC_TEST_NETWORK_WEBSOCKET_PROVIDER,
  },
  polygonMainNetwork: {
    parseEventsFromHeight: parseInt(process.env.BRIDGE_POLYGON_MAINNETWORK_PARSE_EVENTS_FROM_HEIGHT) || 0,
    contractAddress: process.env.BRIDGE_POLYGON_MAINNETWORK_CONTRACT,
    linkWsProvider: process.env.BRIDGE_POLYGON_MAINNETWORK_WEBSOCKET_PROVIDER,
  },
  mumbaiTestNetwork: {
    parseEventsFromHeight: parseInt(process.env.MUMBAI_TEST_NETWORK_BRIDGE_PARSE_EVENTS_FROM_HEIGHT) || 0,
    contractAddress: process.env.MUMBAI_TEST_NETWORK_BRIDGE_CONTRACT,
    linkWsProvider: process.env.MUMBAI_TEST_NETWORK_BRIDGE_WEBSOCKET_PROVIDER,
  },

  defaultWqConfigNetwork: (): { contractAddress: string, linkTendermintProvider: string, linkRpcProvider: string, parseEventsFromHeight: number } => {
    // @ts-ignore
    return this.default[this.default.workQuestNetwork];
  },
  defaultBscConfigNetwork: (): { contractAddress: string, linkWsProvider: string, parseEventsFromHeight: number } => {
    // @ts-ignore
    return this.default[this.default.bscNetwork];
  },
  defaultEthConfigNetwork: (): { contractAddress: string, linkWsProvider: string, parseEventsFromHeight: number } => {
    // @ts-ignore
    return this.default[this.default.ethereumNetwork];
  },
  defaultPolygonConfigNetwork: (): { contractAddress: string, linkWsProvider: string, parseEventsFromHeight: number } => {
    // @ts-ignore
    return this.default[this.default.polygonscanNetwork];
  },
};
