import Web3 from "web3";
import { createClient } from "redis";
import { Logger } from "./logger/pino";
import { QuestClients } from "./src/providers/types";
import configQuest from "./config/config.quest";
import configDatabase from "./config/config.database";
import { QuestProvider } from "./src/providers/QuestProvider";
import { TransactionBroker } from "../brokers/src/TransactionBroker";
import { NotificationBroker } from "../brokers/src/NotificationBroker";
import { QuestController } from "./src/controllers/QuestController";
import { QuestCacheProvider } from "./src/providers/QuestCacheProvider";
import {Networks, Store, WorkQuestNetworkContracts} from "@workquest/contract-data-pools";
import { CommunicationBroker } from "../brokers/src/CommunicationBroker";
import {
  initDatabase,
  QuestBlockInfo,
  BlockchainNetworks,
} from "@workquest/database-models/lib/models";

export async function init() {
  Logger.info('Start worker "Quest". Network: "%s"', configQuest.network);

  const contractData = Store[Networks.WorkQuest][WorkQuestNetworkContracts.QuestFactory];

  await initDatabase(configDatabase.dbLink, false, true);

  const redisConfig = configDatabase.redis.defaultConfigNetwork();
  const { linkRpcProvider } = configQuest.defaultConfigNetwork();

  Logger.debug('Link Rpc provider: "%s"', linkRpcProvider);
  Logger.debug('Redis number database: "%s"', redisConfig.number);

  const redisClient = createClient(redisConfig);

  await redisClient.on('error', (err) => {
    Logger.error(err, 'Redis is stopped with error');
    process.exit(-1);
  });
  await redisClient.connect();

  const web3 = new Web3(new Web3.providers.HttpProvider(linkRpcProvider));

  const transactionsBroker = new TransactionBroker(configDatabase.mqLink, 'quest');
  await transactionsBroker.init();

  const notificationsBroker = new NotificationBroker(configDatabase.notificationMessageBrokerLink, 'quest');
  await notificationsBroker.init();

  const communicationBroker = new CommunicationBroker(configDatabase.mqLink);
  await communicationBroker.init();

  const questCacheProvider = new QuestCacheProvider(redisClient as any);
  const clients: QuestClients = { web3, questCacheProvider, transactionsBroker, notificationsBroker, communicationBroker };

  const [questBlockInfo] = await QuestBlockInfo.findOrCreate({
    where: { network: configQuest.network },
    defaults: {
      network: configQuest.network,
      lastParsedBlock: contractData.deploymentHeight,
    },
  });

  const questProvider = new QuestProvider(clients);
  const questController = new QuestController(clients, questProvider, configQuest.network as BlockchainNetworks);

  await questController.collectAllUncollectedEvents(questBlockInfo.lastParsedBlock);

  await questController.start();
}

init().catch(e => {
  Logger.error(e, 'Worker "Quest" is stopped with error');
  process.exit(-1);
});

