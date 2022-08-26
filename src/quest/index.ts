import Web3 from "web3";
import { Logger } from "./logger/pino";
import configQuest from "./config/config.quest";
import configDatabase from "./config/config.database";
import { QuestMQProvider } from "./src/providers/QuestProvider";
import { QuestCacheProvider } from "./src/providers/QuestCacheProvider";
import { SupervisorContract, SupervisorContractTasks } from "../supervisor";
import { QuestListenerController } from "./src/controllers/QuestController";
import { BlockchainNetworks, initDatabase } from "@workquest/database-models/lib/models";
import { Networks, Store, WorkQuestNetworkContracts } from "@workquest/contract-data-pools";
import {
  BridgeMQBetweenWorkers,
  NotificationMQSenderClient,
  TransactionMQListener
} from "../middleware";

export async function init() {
  await initDatabase(configDatabase.dbLink, false, true);

  Logger.info('Start worker "Quest". Network: "%s"', configQuest.network);

  const contractData = Store[Networks.WorkQuest][WorkQuestNetworkContracts.QuestFactory];

  const redisConfig = configDatabase.redis.defaultConfigNetwork();
  const { linkRpcProvider } = configQuest.defaultConfigNetwork();

  Logger.debug('Link Rpc provider: "%s"', linkRpcProvider);
  Logger.debug('Redis number database: "%s"', redisConfig.number);

  const web3 = new Web3(new Web3.providers.HttpProvider(linkRpcProvider));

  const questCacheProvider = await new QuestCacheProvider(redisConfig)
    .on('error', (error) => {
      Logger.error(error, 'Quest cache provider stopped with error');
      process.exit(-1);
    })
    .init()

  const bridgeBetweenWorkers = await new BridgeMQBetweenWorkers(configDatabase.mqLink)
    .on('error', (error) => {
      Logger.error(error, 'Quest cache provider stopped with error');
      process.exit(-1);
    })
    .init()

  const transactionListener = await new TransactionMQListener(configDatabase.mqLink, 'quest')
    .on('error', (error) => {
      Logger.error(error, 'Transaction listener stopped with error');
      process.exit(-1);
    })
    .init()

  const notificationClient = await new NotificationMQSenderClient(configDatabase.notificationMessageBrokerLink, 'quest')
    .on('error', (error) => {
      Logger.error(error, 'Notification client stopped with error');
      process.exit(-1);
    })
    .init()

  const questProvider = new QuestMQProvider(
    contractData.getAbi(),
    web3,
    Logger.child({
      target: `QuestMQProvider ("${configQuest.network})"`,
    }),
    contractData.deploymentHeight,
    transactionListener,
    questCacheProvider,
  );

  const questController = new QuestListenerController(
    web3,
    Logger.child({
      target: `QuestListenerController ("${configQuest.network})"`,
    }),
    configQuest.network as BlockchainNetworks,
    notificationClient,
    questCacheProvider,
    questProvider,
    bridgeBetweenWorkers,
  );

  await new SupervisorContract(
    Logger.child({
      target: `SupervisorContract ("${configQuest.network})"`,
    }),
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

