import {config} from "dotenv";

config({ path: __dirname +  '/../../../.env.quest'});

export default {
  logLevel: 'debug',
  network: process.env.BLOCKCHAIN_NETWORK, // workQuestDevNetwork, workQuestTestNetwork, workQuestMainNetwork
  workQuestDevNetwork: {
    linkRpcProvider: process.env.WORK_QUEST_DEV_NETWORK_RPC_PROVIDER,
    linkTendermintProvider: process.env.WORK_QUEST_DEV_NETWORK_TENDERMINT_PROVIDER,
    parseEventsFromHeight: parseInt(process.env.WORK_QUEST_DEV_NETWORK_QUEST_PARSE_EVENTS_FROM_HEIGHT || '0'),
  },
  workQuestTestNetwork: {

  },
  workQuestMainNetwork: {

  },
  defaultConfigNetwork: (): { linkTendermintProvider: string, linkRpcProvider: string, parseEventsFromHeight: number } => {
    // @ts-ignore
    return this.default[this.default.network];
  },
}
