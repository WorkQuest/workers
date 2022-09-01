import { config } from 'dotenv';

config({ path: __dirname + '/../../../.env.pensionFund' });

export default {
  logLevel: 'debug',

  network: () => {
    const networkArg = process.argv
      .find(argv => argv.includes("--network="))

    return networkArg
      ? networkArg.replace("--network=", "")
      : undefined
  },

  workQuestDevNetwork: {
    linkRpcProvider: process.env.WORK_QUEST_DEV_NETWORK_RPC_PROVIDER,
  },
  workQuestTestNetwork: {
    linkRpcProvider: process.env.WORK_QUEST_TEST_NETWORK_RPC_PROVIDER,
  },
  workQuestMainNetwork: {
    linkRpcProvider: process.env.WORK_QUEST_MAIN_NETWORK_RPC_PROVIDER,
  },

  configForNetwork: (): { linkRpcProvider: string, linkWsProvider?: string } => {
    // @ts-ignore
    return this.default[this.default.network()];
  },
};
