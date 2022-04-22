import {config} from "dotenv";

config({ path: __dirname +  '/../../../.env.questFactory'});

export default {
  logLevel: 'debug',
  sentryLink: process.env.DEV_SENTRY_LINK || '',
  network: process.env.WORK_QUEST_BLOCKCHAIN_NETWORK, // workQuestDevNetwork, workQuestTestNetwork, workQuestMainNetwork
  workQuestDevNetwork: {
    contractAddress: process.env.WORK_QUEST_DEV_NETWORK_QUEST_FACTORY_CONTRACT_ADDRESS,
    linkTendermintProvider: process.env.WORK_QUEST_DEV_NETWORK_TENDERMINT_PROVIDER,
    linkRpcProvider: process.env.WORK_QUEST_DEV_NETWORK_RPC_PROVIDER,
    parseEventsFromHeight: parseInt(process.env.WORK_QUEST_DEV_NETWORK_QUEST_FACTORY_PARSE_EVENTS_FROM_HEIGHT || "0"),
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
