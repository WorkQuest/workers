import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.bridge' });

export default {
  // TODO: BLOCKCHAIN_NETWORK я думаю лучше в WORK_QUEST_BLOCKCHAIN_NETWORK переименовать, и посмотри где используется и переименуй в воркерах
  workQuestNetwork: process.env.BLOCKCHAIN_NETWORK, // workQuestDevNetwork, workQuestTestNetwork, workQuestMainNetwork
  bscNetwork: process.env.BSC_BLOCKCHAIN_NETWORK, // bscMainNetwork, bscTestNetwork
  ethereumNetwork: process.env.ETHEREUM_BLOCKCHAIN_NETWORK, // ethereumMainNetwork, rinkebyTestNetwork

  workQuestDevNetwork: {
    contractAddress: process.env.BRIDGE_WQ_DEV_NETWORK_CONTRACT,
    linkTendermintProvider: process.env.WORK_QUEST_DEV_NETWORK_TENDERMINT_PROVIDER,
    linkRpcProvider: process.env.WORK_QUEST_DEV_NETWORK_RPC_PROVIDER,
    parseEventsFromHeight: parseInt(process.env.PROPOSAL_WQ_DEV_NETWORK_PARSE_EVENTS_FROM_HEIGHT),
  },
  workQuestTestNetwork: {
  },
  workQuestMainNetwork: {
  },
  ethereumMainNetwork: {
    parseEventsFromHeight: parseInt(process.env.BRIDGE_ETH_MAINNETWORK_PARSE_EVENTS_FROM_HEIGHT),
    contractAddress: process.env.BRIDGE_ETH_MAINNETWORK_CONTRACT,
    linkWebSocketProvider: process.env.BRIDGE_ETH_MAINNETWORK_WEBSOCKET_PROVIDER, // TODO вывести в разных сетях (eth, bnb) один сокет провайдер как в WQ Dev Network
  },
  bscMainNetwork: {
    parseEventsFromHeight: parseInt(process.env.BRIDGE_BSC_MAINNETWORK_PARSE_EVENTS_FROM_HEIGHT),
    contractAddress: process.env.BRIDGE_BSC_MAINNETWORK_CONTRACT,
    linkWebSocketProvider: process.env.BRIDGE_BSC_MAINNETWORK_WEBSOCKET_PROVIDER, // TODO вывести в разных сетях (eth, bnb) один сокет провайдер как в WQ Dev Network
  },
  rinkebyTestNetwork: {
    parseEventsFromHeight: parseInt(process.env.BRIDGE_RINKEBY_TESTNETWORK_PARSE_EVENTS_FROM_HEIGHT),
    contractAddress: process.env.BRIDGE_RINKEBY_TESTNETWORK_CONTRACT,
    linkWebSocketProvider: process.env.BRIDGE_RINKEBY_TESTNETWORK_WEBSOCKET_PROVIDER,
  },
  bscTestNetwork: {
    parseEventsFromHeight: parseInt(process.env.BRIDGE_BSC_TESTNETWORK_PARSE_EVENTS_FROM_HEIGHT),
    contractAddress: process.env.BRIDGE_BSC_TESTNETWORK_CONTRACT,
    linkWebSocketProvider: process.env.BRIDGE_BSC_TESTNETWORK_WEBSOCKET_PROVIDER, // TODO вывести в разных сетях (eth, bnb) один сокет провайдер как в WQ Dev Network
  },
  privateKey: process.env.BRIDGE_CONTRACT_PRIVAT_KEY,
};
