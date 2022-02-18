import {config} from "dotenv";

config({ path: __dirname +  '/../../../.env.questFactory'});

export default {
  network: process.env.QUEST_FACTORY_NETWORK, // workQuestDevNetwork, workQuestTestNetwork, workQuestMainNetwork
  workQuestDevNetwork: {
    contractAddress: process.env.QUEST_FACTORY_WQ_DEVNETWORK_CONTRACT,
    linkTendermintProvider: process.env.WORK_QUEST_DEV_NETWORK_TENDERMINT_PROVIDER,
    linkRpcProvider: process.env.WORK_QUEST_DEV_NETWORK_RPC_PROVIDER,
    parseEventsFromHeight: parseInt(process.env.QUEST_FACTORY_WQ_DEVNETWORK_PARSE_EVENTS_FROM_HEIGHT),
  },
  workQuestTestNetwork: {

  },
  workQuestMainNetwork: {

  },
  defaultConfigNetwork: (): { contractAddress: string, linkTendermintProvider: string, linkRpcProvider: string, parseEventsFromHeight: number } => {
    // @ts-ignore
    return this.default[this.default.network];
  },
}
