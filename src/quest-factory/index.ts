import Web3 from 'web3';
import {createClient} from 'redis';
import {Logger} from "./logger/pino";
import configDatabase from './config/config.database';
import configQuestFactory from './config/config.questFactory';
import {QuestFactoryClients} from "./src/providers/types";
import {TransactionBroker} from "../brokers/src/TransactionBroker";
import {NotificationBroker} from "../brokers/src/NotificationBroker";
import {QuestFactoryProvider} from "./src/providers/QuestFactoryProvider";
import {SupervisorContract, SupervisorContractTasks} from "../supervisor";
import {QuestCacheProvider} from "../quest/src/providers/QuestCacheProvider";
import {QuestFactoryController} from './src/controllers/QuestFactoryController';
import {initDatabase, BlockchainNetworks} from '@workquest/database-models/lib/models';
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

  const transactionsBroker = new TransactionBroker(configDatabase.mqLink, 'quest-factory');
  await transactionsBroker.init()

  const notificationsBroker = new NotificationBroker(configDatabase.notificationMessageBrokerLink, 'quest');
  await notificationsBroker.init();

  const questCacheProvider = new QuestCacheProvider(redisClient as any);
  const clients: QuestFactoryClients = { web3, questCacheProvider, transactionsBroker, notificationsBroker };

  const questFactoryProvider = new QuestFactoryProvider(
    contractData.address,
    contractData.deploymentHeight,
    questFactoryContract,
    clients,
  );

  const questFactoryController = new QuestFactoryController(
    clients,
    questFactoryProvider,
    configQuestFactory.network as BlockchainNetworks,
  );

  await new SupervisorContract(
    Logger,
    questFactoryController,
    questFactoryProvider,
  )
  .startTasks(SupervisorContractTasks.BlockHeightSync)
}

init().catch(e => {
  Logger.error(e, 'Worker "Quest factory" is stopped with error');
  process.exit(-1);
});
