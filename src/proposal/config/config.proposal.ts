import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.proposal' });

export default {
  network: process.env.PROPOSAL_NETWORK, // workQuestDevNetwork, workQuestTestNetwork, workQuestMainNetwork
  workQuestDevNetwork: {
    contractAddress: process.env.PROPOSAL_WQ_DEVNETWORK_CONTRACT,
    linkTendermintProvider: process.env.WORK_QUEST_DEV_NETWORK_TENDERMINT_PROVIDER,
    linkRpcProvider: process.env.WORK_QUEST_DEV_NETWORK_RPC_PROVIDER,
    parseEventsFromHeight: parseInt(process.env.WORK_QUEST_DEV_NETWORK_PARSE_EVENTS_FROM_HEIGHT),
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
