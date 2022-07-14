import Web3 from 'web3';
import {createClient} from 'redis';
import {Logger} from "./logger/pino";
import configDatabase from './config/config.database';
import configQuestFactory from './config/config.questFactory';
import {NotificationMQClient, TransactionMQListener} from "../middleware";
import {SupervisorContract, SupervisorContractTasks} from "../supervisor";
import {QuestFactoryMQProvider} from "./src/providers/QuestFactoryProvider";
import {QuestCacheProvider} from "../quest/src/providers/QuestCacheProvider";
import {initDatabase, BlockchainNetworks} from '@workquest/database-models/lib/models';
import {QuestFactoryListenerController} from './src/controllers/QuestFactoryController';
import {Networks, Store, WorkQuestNetworkContracts} from "@workquest/contract-data-pools";

export async function init() {
  Logger.info('Start worker "Quest factory". Network: "%s"', configQuestFactory.network);

  await initDatabase(configDatabase.dbLink, false, true);

  const contractData = Store[Networks.WorkQuest][WorkQuestNetworkContracts.QuestFactory];

  const { number, url } = configDatabase.redis.defaultConfigNetwork();
  const { linkRpcProvider } = configQuestFactory.defaultConfigNetwork();

  Logger.info('Listening on contract address: "%s"', contractData.address);
  Logger.debug('Link Rpc provider: "%s"', linkRpcProvider);

  const redisClient = createClient({ url, database: number });

  redisClient.on('error', (e) => {
    Logger.error(e, 'Redis is stopped with error');
    process.exit(-1);
  });

  await redisClient.connect();

  const web3 = new Web3(new Web3.providers.HttpProvider(linkRpcProvider));
  const questFactoryContract = new web3.eth.Contract(contractData.getAbi(), contractData.address);

  const questCacheProvider = new QuestCacheProvider(redisClient as any);

  const transactionListener = new TransactionMQListener(configDatabase.mqLink, 'quest-factory');
  const notificationClient = new NotificationMQClient(configDatabase.notificationMessageBrokerLink, 'quest');

  const questFactoryProvider = new QuestFactoryMQProvider(
    contractData.address,
    contractData.deploymentHeight,
    web3,
    questFactoryContract,
    transactionListener,
  );

  const questFactoryController = new QuestFactoryListenerController(
    web3,
    configQuestFactory.network as BlockchainNetworks,
    notificationClient,
    questCacheProvider,
    questFactoryProvider,
  );

  await notificationClient.init();
  await transactionListener.init();

  await new SupervisorContract(
    Logger,
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
