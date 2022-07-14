import Web3 from "web3";
import {createClient} from "redis";
import {Logger} from "./logger/pino";
import configQuest from "./config/config.quest";
import {QuestClients } from "./src/providers/types";
import configDatabase from "./config/config.database";
import {QuestMQProvider} from "./src/providers/QuestProvider";
import {TransactionBroker} from "../middleware/src/TransactionBroker";
import {NotificationBroker} from "../middleware/src/NotificationBroker";
import {QuestCacheProvider} from "./src/providers/QuestCacheProvider";
import {CommunicationBroker} from "../middleware/src/CommunicationBroker";
import {SupervisorContract, SupervisorContractTasks} from "../supervisor";
import {QuestListenerController} from "./src/controllers/QuestController";
import {Networks, Store, WorkQuestNetworkContracts} from "@workquest/contract-data-pools";
import {initDatabase, BlockchainNetworks} from "@workquest/database-models/lib/models";

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

  const questProvider = new QuestMQProvider(
    contractData.getAbi(),
    contractData.deploymentHeight,
    clients
  );

  const questController = new QuestListenerController(
    clients,
    configQuest.network as BlockchainNetworks,
    questProvider,
  );

  await new SupervisorContract(
    Logger,
    questController,
    questProvider,
  )
  .setHeightSyncOptions({ period: 300000 })
  .startTasks(SupervisorContractTasks.BlockHeightSync)
}

init().catch(e => {
  Logger.error(e, 'Worker "Quest" is stopped with error');
  process.exit(-1);
});

