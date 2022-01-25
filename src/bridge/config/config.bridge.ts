import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.bridge' });

export default {
  debug: process.env.BRIDGE_DEBUG === 'true',
  ethereumMainNetwork: {
    parseEventsFromHeight: parseInt(process.env.BRIDGE_ETH_MAINNETWORK_PARSE_EVENTS_FROM_HEIGHT),
    contract: process.env.BRIDGE_ETH_MAINNETWORK_CONTRACT,
    webSocketProvider: process.env.BRIDGE_ETH_MAINNETWORK_WEBSOCKET_PROVIDER,
  },
  bscMainNetwork: {
    parseEventsFromHeight: parseInt(process.env.BRIDGE_BSC_MAINNETWORK_PARSE_EVENTS_FROM_HEIGHT),
    contract: process.env.BRIDGE_BSC_MAINNETWORK_CONTRACT,
    webSocketProvider: process.env.BRIDGE_BSC_MAINNETWORK_WEBSOCKET_PROVIDER,
  },
  rinkebyTestNetwork: {
    parseEventsFromHeight: parseInt(process.env.BRIDGE_RINKEBY_TESTNETWORK_PARSE_EVENTS_FROM_HEIGHT),
    contract: process.env.BRIDGE_RINKEBY_TESTNETWORK_CONTRACT,
    webSocketProvider: process.env.BRIDGE_RINKEBY_TESTNETWORK_WEBSOCKET_PROVIDER,
  },
  bscTestNetwork: {
    parseEventsFromHeight: parseInt(process.env.BRIDGE_BSC_TESTNETWORK_PARSE_EVENTS_FROM_HEIGHT),
    contract: process.env.BRIDGE_BSC_TESTNETWORK_CONTRACT,
    webSocketProvider: process.env.BRIDGE_BSC_TESTNETWORK_WEBSOCKET_PROVIDER,
  },
  privateKey: process.env.BRIDGE_CONTRACT_PRIVAT_KEY,
};
