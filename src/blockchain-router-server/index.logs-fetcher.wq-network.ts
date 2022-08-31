import Web3 from "web3";
import configRouterServices from "./config/config.services";
import configRouterServer from "./config/config.router-server";
import {ServerRouterServices} from "../middleware/middleware.types"
import {BlockchainNetworks} from "@workquest/database-models/lib/models";
import {BlockchainNewLogNotificationsServer} from "./src/BlockchainNewLogNotificationsServer";
import {
  LoggerFactory,
  RouterMQServer,
  LogsFetcherWorker,
  EventLogsRedisRepository,
  BlockchainRepositoryWithCaching,
} from "../middleware";

async function init() {
  const network = configRouterServer.network() as BlockchainNetworks.workQuestNetwork | BlockchainNetworks.workQuestDevNetwork;

  const Logger = LoggerFactory.createLogger(`LogsFetcher.RouterServer:${network || ''}`, 'Common');
  const BlockchainRepositoryLogger = LoggerFactory.createLogger(`RouterServer:${network || ''}`, 'BlockchainRepository');

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
    BlockchainRepositoryLogger,
    { stepsRange: 2000 },
    logsRedisRepo,
  );

  const logsFetcherWorker = new LogsFetcherWorker(
    blockchainRepository,
  );

  const routerServer = await new RouterMQServer(
    configRouterServices.messageOriented.routerServerMessageBrokerLink,
    network,
    ServerRouterServices.SendingNewLogs,
  )
    .on('error', (error) => {
      Logger.error(error, 'RouterMQServer stopped with error.');
      process.exit(-1);
    })
    .init()

  new BlockchainNewLogNotificationsServer(
    routerServer,
    logsFetcherWorker,
  )
    .start()
}

init().catch((error) => {
  console.error(error);
  process.exit(-1);
});
