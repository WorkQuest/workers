import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.bridgeUsdt' });

export default {
  logLevel: 'debug',
  workQuestNetwork: process.env.WORK_QUEST_BLOCKCHAIN_NETWORK, // workQuestDevNetwork, workQuestTestNetwork, workQuestMainNetwork
  bscNetwork: process.env.BSC_BLOCKCHAIN_NETWORK, // bscMainNetwork, bscTestNetwork
  ethereumNetwork: process.env.ETHEREUM_BLOCKCHAIN_NETWORK, // ethereumMainNetwork, rinkebyTestNetwork
  polygonscanNetwork: process.env.POLYGONSCAN_BLOCKCHAIN_NETWORK,//PolygonscanMainNetwork, MumbaiTestNetwork
  faucetPrivateKey: process.env.PRIVATE_KEY_TO_SEND_FIRST_WQT,
  faucetWalletAddress: process.env.WALLET_ADDRESS_TO_SEND_FIRST_WQT,
  oracleLink: process.env.ORACLE_LINK,
  privateKey: process.env.SWAP_USDT_CONTRACT_PRIVATE_KEY,
  workQuestTestNetwork: {
    linkRpcProvider: process.env.WORK_QUEST_TEST_NETWORK_RPC_PROVIDER,
  },
  workQuestMainNetwork: {

  },
  workQuestDevNetwork: {
    linkRpcProvider: process.env.WORK_QUEST_DEV_NETWORK_RPC_PROVIDER,
  },
  ethereumMainNetwork: {
    linkWsProvider: process.env.ETH_MAIN_NETWORK_WEBSOCKET_PROVIDER,
  },
  rinkebyTestNetwork: {
    linkWsProvider: process.env.RINKEBY_TEST_NETWORK_WEBSOCKET_PROVIDER,
  },
  bscMainNetwork: {
    linkWsProvider: process.env.BSC_MAIN_NETWORK_WEBSOCKET_PROVIDER,
  },
  bscTestNetwork: {
    linkWsProvider: process.env.BSC_TEST_NETWORK_WEBSOCKET_PROVIDER,
  },
  polygonMainNetwork: {
    linkWsProvider: process.env.POLYGON_MAIN_NETWORK_WEBSOCKET_PROVIDER,
  },
  mumbaiTestNetwork: {
    linkWsProvider: process.env.MUMBAI_TEST_NETWORK_WEBSOCKET_PROVIDER,
  },

  defaultWqConfigNetwork: (): { linkRpcProvider: string } => {
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
  defaultPolygonConfigNetwork: (): { linkWsProvider: string } => {
    // @ts-ignore
    return this.default[this.default.polygonscanNetwork];
  },
};
