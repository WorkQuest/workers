import {config} from "dotenv";

config({ path: __dirname +  '/../../../.env.raiseView'});

export default {
  logLevel: 'debug',
  network: process.env.WORK_QUEST_BLOCKCHAIN_NETWORK,
  workQuestDevNetwork: {
    contractAddress: process.env.WORK_QUEST_DEV_NETWORK_RAISE_VIEW_CONTRACT_ADDRESS,
    parseEventsFromHeight: parseInt(process.env.WORK_QUEST_DEV_NETWORK_RAISE_VIEW_PARSE_EVENTS_FROM_HEIGHT || "0"),
    linkRpcProvider: process.env.WORK_QUEST_DEV_NETWORK_RPC_PROVIDER,
  },
  defaultConfigNetwork: (): { contractAddress: string, linkRpcProvider: string, parseEventsFromHeight: number } => {
    // @ts-ignore
    return this.default[this.default.network];
  },
}
