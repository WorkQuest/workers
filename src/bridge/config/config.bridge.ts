import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.bridge' });

export default {
  workQuestNetwork: process.env.BLOCKCHAIN_NETWORK, // workQuestDevNetwork, workQuestTestNetwork, workQuestMainNetwork
  bscNetwork: process.env.BSC_BLOCKCHAIN_NETWORK, // bscMainNetwork, bscTestNetwork
  ethereumNetwork: process.env.ETHEREUM_BLOCKCHAIN_NETWORK, // ethereumMainNetwork, rinkebyTestNetwork

  workQuestDevNetwork: {
    contractAddress: process.env.WORK_QUEST_DEV_NETWORK_BRIDGE_CONTRACT,
    linkTendermintProvider: process.env.WORK_QUEST_DEV_NETWORK_TENDERMINT_PROVIDER,
    linkRpcProvider: process.env.WORK_QUEST_DEV_NETWORK_RPC_PROVIDER,
    parseEventsFromHeight: parseInt(process.env.WORK_QUEST_DEV_NETWORK_BRIDGE_PARSE_EVENTS_FROM_HEIGHT),
  },
  workQuestTestNetwork: {
  },
  workQuestMainNetwork: {
  },
  ethereumMainNetwork: {
    parseEventsFromHeight: parseInt(process.env.BRIDGE_ETH_MAINNETWORK_PARSE_EVENTS_FROM_HEIGHT),
    contractAddress: process.env.BRIDGE_ETH_MAINNETWORK_CONTRACT,
    linkWsProvider: process.env.BRIDGE_ETH_MAINNETWORK_WEBSOCKET_PROVIDER, // TODO вывести в разных сетях (eth, bnb) один сокет провайдер как в WQ Dev Network
  },
  bscMainNetwork: {
    parseEventsFromHeight: parseInt(process.env.BRIDGE_BSC_MAINNETWORK_PARSE_EVENTS_FROM_HEIGHT),
    contractAddress: process.env.BRIDGE_BSC_MAINNETWORK_CONTRACT,
    linkWebSocketProvider: process.env.BRIDGE_BSC_MAINNETWORK_WEBSOCKET_PROVIDER, // TODO вывести в разных сетях (eth, bnb) один сокет провайдер как в WQ Dev Network
  },
  rinkebyTestNetwork: {
    parseEventsFromHeight: parseInt(process.env.RINKEBY_TEST_NETWORK_BRIDGE_PARSE_EVENTS_FROM_HEIGHT),
    contractAddress: process.env.RINKEBY_TEST_NETWORK_BRIDGE_CONTRACT,
    linkWsProvider: process.env.RINKEBY_TEST_NETWORK_BRIDGE_WEBSOCKET_PROVIDER,
  },
  bscTestNetwork: {
    parseEventsFromHeight: parseInt(process.env.BSC_TEST_NETWORK_BRIDGE_PARSE_EVENTS_FROM_HEIGHT),
    contractAddress: process.env.BSC_TEST_NETWORK_BRIDGE_CONTRACT,
    linkWsProvider: process.env.BSC_TEST_NETWORK_BRIDGE_WEBSOCKET_PROVIDER, // TODO вывести в разных сетях (eth, bnb) один сокет провайдер как в WQ Dev Network
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
  privateKey: process.env.BRIDGE_CONTRACT_PRIVATE_KEY,
};
