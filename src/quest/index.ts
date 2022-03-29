import Web3 from "web3";
import {createClient} from "redis";
import { QuestClients } from "./src/providers/types";
import configQuest from "./config/config.quest";
import configDatabase from "./config/config.database";
import { QuestController } from "./src/controllers/QuestController";
import { QuestCacheProvider } from "./src/providers/QuestCacheProvider";
import { ChildProcessProvider } from "./src/providers/ChildProcessProvider";
import {
  initDatabase,
  QuestBlockInfo,
  BlockchainNetworks,
} from "@workquest/database-models/lib/models";

export async function init() {
  await initDatabase(configDatabase.dbLink, false, true);

  const redisConfig = configDatabase.redis.defaultConfigNetwork();
  const { linkRpcProvider, parseEventsFromHeight } = configQuest.defaultConfigNetwork();

  const redisClient = createClient(redisConfig);

  await redisClient.on('error', (err) => { throw err });
  await redisClient.connect();

  const web3 = new Web3(new Web3.providers.HttpProvider(linkRpcProvider));

  // @ts-ignore
  const questCacheProvider = new QuestCacheProvider(redisClient);
  const clients: QuestClients = { web3, questCacheProvider };

  const [questBlockInfo] = await QuestBlockInfo.findOrCreate({
    where: { network: configQuest.network },
    defaults: {
      network: configQuest.network,
      lastParsedBlock: parseEventsFromHeight,
    },
  });

  if (questBlockInfo.lastParsedBlock < parseEventsFromHeight) {
    questBlockInfo.lastParsedBlock = parseEventsFromHeight;

    await questBlockInfo.save();
  }

  const questProvider = new ChildProcessProvider(clients);
  const questController = new QuestController(clients, questProvider, configQuest.network as BlockchainNetworks);

  await questController.collectAllUncollectedEvents(questBlockInfo.lastParsedBlock);

  questProvider.startListener();
}

init().catch(e => { throw e });

