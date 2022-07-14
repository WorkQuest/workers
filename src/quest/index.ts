import Web3 from "web3";
import {createClient} from "redis";
import {Logger} from "./logger/pino";
import configQuest from "./config/config.quest";
import configDatabase from "./config/config.database";
import {QuestMQProvider} from "./src/providers/QuestProvider";
import {QuestCacheProvider} from "./src/providers/QuestCacheProvider";
import {SupervisorContract, SupervisorContractTasks} from "../supervisor";
import {QuestListenerController} from "./src/controllers/QuestController";
import {Networks, Store, WorkQuestNetworkContracts} from "@workquest/contract-data-pools";
import {initDatabase, BlockchainNetworks} from "@workquest/database-models/lib/models";
import {BridgeMQBetweenWorkers, NotificationMQClient, TransactionMQListener} from "../middleware";

export async function init() {
  await initDatabase(configDatabase.dbLink, false, true);

  Logger.info('Start worker "Quest". Network: "%s"', configQuest.network);

  const contractData = Store[Networks.WorkQuest][WorkQuestNetworkContracts.QuestFactory];

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

  const questCacheProvider = new QuestCacheProvider(redisClient as any);

  const web3 = new Web3(new Web3.providers.HttpProvider(linkRpcProvider));

  const bridgeBetweenWorkers = new BridgeMQBetweenWorkers(configDatabase.mqLink);
  const transactionListener = new TransactionMQListener(configDatabase.mqLink, 'quest');
  const notificationsBroker = new NotificationMQClient(configDatabase.notificationMessageBrokerLink, 'quest');

  const questProvider = new QuestMQProvider(
    contractData.getAbi(),
    web3,
    contractData.deploymentHeight,
    transactionListener,
    questCacheProvider,
  );

  const questController = new QuestListenerController(
    web3,
    configQuest.network as BlockchainNetworks,
    notificationsBroker,
    questCacheProvider,
    questProvider,
    bridgeBetweenWorkers,
  );

  await transactionListener.init();
  await notificationsBroker.init();
  await bridgeBetweenWorkers.init();

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

