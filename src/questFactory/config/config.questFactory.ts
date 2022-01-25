import {config} from "dotenv";

config({ path: __dirname +  '/../../../.env.questFactory'});

export default {
  debug: process.env.BRIDGE_DEBUG === "true",
  workQuestDevNetwork: {
    questFactory: {
      contractAddress: process.env.QUEST_FACTORY_WQ_DEVNETWORK_CONTRACT,
      parseEventsFromHeight: parseInt(process.env.QUEST_FACTORY_WQ_DEVNETWORK_PARSE_EVENTS_FROM_HEIGHT),
    },
    quest: {
      contractAddress: process.env.QUEST_WQ_DEVNETWORK_CONTRACT,
      parseEventsFromHeight: parseInt(process.env.QUEST_WQ_DEVNETWORK_PARSE_EVENTS_FROM_HEIGHT),
    },
    webSocketProvider: process.env.WQ_DEVNETWORK_WEBSOCKET_PROVIDER,
  },
}
