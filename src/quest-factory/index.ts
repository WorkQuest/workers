import Web3 from 'web3';
import {Logger} from "./logger/pino";
import configDatabase from './config/config.database';
import configQuestFactory from './config/config.questFactory';
import {SupervisorContract, SupervisorContractTasks} from "../supervisor";
import {NotificationMQSenderClient, TransactionMQListener} from "../middleware";
import {QuestFactoryMQProvider} from "./src/providers/QuestFactoryProvider";
import {QuestCacheProvider} from "../quest/src/providers/QuestCacheProvider";
import {initDatabase, BlockchainNetworks} from '@workquest/database-models/lib/models';
import {QuestFactoryListenerController} from './src/controllers/QuestFactoryController';
import {Networks, Store, WorkQuestNetworkContracts} from "@workquest/contract-data-pools";

export async function init() {
  Logger.info('Start worker "Quest factory". Network: "%s"', configQuestFactory.network);

  await initDatabase(configDatabase.dbLink, false, true);

  const contractData = Store[Networks.WorkQuest][WorkQuestNetworkContracts.QuestFactory];

  const redisConfig = configDatabase.redis.defaultConfigNetwork();
  const { linkRpcProvider } = configQuestFactory.defaultConfigNetwork();

  Logger.info('Listening on contract address: "%s"', contractData.address);
  Logger.debug('Link Rpc provider: "%s"', linkRpcProvider);

  const web3 = new Web3(new Web3.providers.HttpProvider(linkRpcProvider));
  const questFactoryContract = new web3.eth.Contract(contractData.getAbi(), contractData.address);

  const questCacheProvider = await new QuestCacheProvider(redisConfig)
    .on('error', (error) => {
      Logger.error(error, 'Quest cache provider stopped with error');
      process.exit(-1);
    })
    .init()

  const transactionListener = await new TransactionMQListener(configDatabase.mqLink, 'quest-factory')
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

  const questFactoryProvider = new QuestFactoryMQProvider(
    contractData.address,
    contractData.deploymentHeight,
    web3,
    questFactoryContract,
    Logger.child({
      target: `QuestFactoryMQProvider ("${configQuestFactory.network})"`,
    }),
    transactionListener,
  );

  const questFactoryController = new QuestFactoryListenerController(
    web3,
    Logger.child({
      target: `QuestFactoryListenerController ("${configQuestFactory.network})"`,
    }),
    configQuestFactory.network as BlockchainNetworks,
    notificationClient,
    questCacheProvider,
    questFactoryProvider,
  );

  await new SupervisorContract(
    Logger.child({
      target: `SupervisorContract ("${configQuestFactory.network})"`,
    }),
    questFactoryController,
    questFactoryProvider,
  )
  .setHeightSyncOptions({ period: 300000 })
  .startTasks(SupervisorContractTasks.BlockHeightSync)
}

init().catch(e => {
  Logger.error(e, 'Worker "Quest factory" is stopped with error');
  process.exit(-1);
});
