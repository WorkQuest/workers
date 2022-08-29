import Web3 from "web3";
import configRouterServices from "./config/config.services";
import configRouterServer from "./config/config.router-server";
import {BlockchainLogsServer} from "./src/BlockchainRouterServer";
import {BlockchainNetworks} from "@workquest/database-models/lib/models";
import {RouterMQServer} from "../middleware/message-oriented/RouterMQServer";
import {
  TasksFactory,
  TasksExecutor,
  LoggerFactory,
  LogsFetcherWorker,
  EventLogsRedisRepository,
  BlockchainRepositoryWithCaching,
} from "../middleware";

async function init() {
  const Logger = LoggerFactory.createLogger(`RouterServer:${configRouterServer.network() || ''}`, 'Common');

  const network = configRouterServer.network() as BlockchainNetworks.workQuestNetwork | BlockchainNetworks.workQuestDevNetwork;
  const { linkRpcProvider } = configRouterServer.configForNetwork();
  const wqNetworks = [BlockchainNetworks.workQuestNetwork, BlockchainNetworks.workQuestDevNetwork];

  if (!network) {
    throw new Error('Network argv is undefined. Use arg --network=NetworkName');
  }
  if (!wqNetworks.includes(network)) {
    throw new Error('Use only wq networks.');
  }

  const web3 = new Web3(new Web3.providers.HttpProvider(linkRpcProvider));

  const logsRedisRepo = await new EventLogsRedisRepository(
    network,
    configRouterServices.database.redis,
  )
    .on('error', (error) => {
      Logger.error(error, 'EventLogsRedisRepository stopped with error.');
      process.exit(-1);
    })
    .init()

  const blockchainRepository = new BlockchainRepositoryWithCaching(
    web3,
    { stepsRange: 2000 },
    logsRedisRepo,
  );

  const tasksExecutor = new TasksExecutor({
    concurrency: 10,
    intervalInMs: 10000,
  });

  const tasksFactory = new TasksFactory(
    { getLogs: { stepsRange: 2000 } },
    blockchainRepository,
  );

  const logsFetcherWorker = new LogsFetcherWorker(blockchainRepository);

  const routerServer = await new RouterMQServer(
    configRouterServices.messageOriented.routerServerMessageBrokerLink,
    network,
  )
    .on('error', (error) => {
      Logger.error(error, 'RouterMQServer stopped with error.');
      process.exit(-1);
    })
    .init()

  await new BlockchainLogsServer(
    routerServer,
    tasksFactory,
    tasksExecutor,
    logsFetcherWorker,
  )
    .start()
}

init().catch((error) => {
  console.error(error);
  process.exit(-1);
})
