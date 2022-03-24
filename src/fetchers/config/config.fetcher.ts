import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.fetcher' });

export default {
  network: process.env.BLOCKCHAIN_NETWORK, // workQuestDevNetwork, workQuestTestNetwork, workQuestMainNetwork
  workQuestDevNetwork: {
    linkRpcProvider: process.env.WORK_QUEST_DEV_NETWORK_RPC_PROVIDER,
    proposalContractAddress: process.env.PROPOSAL_WQ_DEV_NETWORK_CONTRACT,
    referralProgramContractAddress: process.env.WORK_QUEST_DEV_NETWORK_REFERRAL_CONTRACT_ADDRESS,
    pensionFundContractAddress: process.env.PENSION_FUND_CONTRACT_ADDRESS,
    bridgeContractAddress: process.env.WORK_QUEST_DEV_NETWORK_BRIDGE_CONTRACT,
  },

  defaultConfigNetwork: (): {
    linkRpcProvider: string,
    proposalContractAddress: string,
    referralProgramContractAddress: string,
    pensionFundContractAddress: string,
    bridgeContractAddress: string,
  } => {
    // @ts-ignore
    return this.default[this.default.network];
  },
}
