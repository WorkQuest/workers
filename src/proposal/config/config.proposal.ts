import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.proposal' });

export default {
  debug: process.env.PROPOSAL_DEBUG === 'true',
  rinkebyTestNetwork: {
    parseEventsFrom: parseInt(process.env.PROPOSAL_RINKEBY_PARSE_EVENTS_FROM_HEIGHT),
    contract: process.env.PROPOSAL_RINKEBY_CONTRACT,
    webSocketProvider: process.env.PROPOSAL_RINKEBY_WEBSOCKET_PROVIDER,
  },
};
