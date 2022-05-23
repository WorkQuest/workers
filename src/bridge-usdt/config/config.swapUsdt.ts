import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.bridgeUsdt' });

export default {
  logLevel: 'debug',
  workQuestNetwork: process.env.WORK_QUEST_BLOCKCHAIN_NETWORK, // workQuestDevNetwork, workQuestTestNetwork, workQuestMainNetwork
  bscNetwork: process.env.BSC_BLOCKCHAIN_NETWORK, // bscMainNetwork, bscTestNetwork
  ethereumNetwork: process.env.ETHEREUM_BLOCKCHAIN_NETWORK, // ethereumMainNetwork, rinkebyTestNetwork
  polygonscanNetwork: process.env.POLYGONSCAN_BLOCKCHAIN_NETWORK,//PolygonscanMainNetwork, MumbaiTestNetwork
  mnemonic: process.env.BRIDGE_USDT_MNEMONIC_WALLET_ADDRESS,
  oracleLink: process.env.ORACLE_LINK,
  privateKey: process.env.SWAP_USDT_CONTRACT_PRIVATE_KEY,
  workQuestDevNetwork: {
    linkRpcProvider: process.env.WORK_QUEST_DEV_NETWORK_RPC_PROVIDER,
  },
  workQuestTestNetwork: {},
  workQuestMainNetwork: {},
  ethereumMainNetwork: {
    parseEventsFromHeight: '',
    contractAddress: '',
    linkWsProvider: process.env.ETH_MAIN_NETWORK_WEBSOCKET_PROVIDER,
  },
  rinkebyTestNetwork: {
    parseEventsFromHeight: 10657190,
    contractAddress: "0x9870a749Ae5CdbC4F96E3D0C067eB212779a8FA1",
    linkWsProvider: process.env.RINKEBY_TEST_NETWORK_WEBSOCKET_PROVIDER,
  },
  bscMainNetwork: {
    parseEventsFromHeight: '',
    contractAddress: '',
    linkWsProvider: process.env.BSC_MAIN_NETWORK_WEBSOCKET_PROVIDER,
  },
  bscTestNetwork: {
    parseEventsFromHeight: 19210132,
    contractAddress: "0x833d71EF0b51Aa9Fb69b1f986381132628ED10F3",
    linkWsProvider: process.env.BSC_TEST_NETWORK_WEBSOCKET_PROVIDER,
  },
  polygonMainNetwork: {
    parseEventsFromHeight: '',
    contractAddress: '',
    linkWsProvider: process.env.POLYGON_MAIN_NETWORK_WEBSOCKET_PROVIDER,
  },
  mumbaiTestNetwork: {
    parseEventsFromHeight: 26284114,
    contractAddress: "0xE2e7518080a0097492087E652E8dEB1f6b96B62b",
    linkWsProvider: process.env.MUMBAI_TEST_NETWORK_WEBSOCKET_PROVIDER,
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
