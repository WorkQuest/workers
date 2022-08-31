import Web3 from "web3";
import configRouterServices from "./config/config.services";
import configRouterServer from "./config/config.router-server";
import {ServerRouterServices} from "../middleware/middleware.types"
import {BlockchainNetworks} from "@workquest/database-models/lib/models";
import {BlockchainTaskExecutorServer} from "./src/BlockchainTaskExecutorServer";
import {Networks, Store, EthNetworkContracts} from "@workquest/contract-data-pools";
import {
  TasksFactory,
  TasksExecutor,
  LoggerFactory,
  RouterMQServer,
  EventLogsRedisRepository,
  BlockchainRepositoryWithCachingAddresses,
} from "../middleware";

function ethContractTrackingAddresses(): string[] {
  return [
    Store[Networks.Eth][EthNetworkContracts.WqtWeth].address,
    Store[Networks.Eth][EthNetworkContracts.WqtBridge].address,
    Store[Networks.Eth][EthNetworkContracts.BridgeUSDT].address,
  ]
}

async function init() {
  const network = configRouterServer.network() as BlockchainNetworks.rinkebyTestNetwork | BlockchainNetworks.ethMainNetwork;

  const Logger = LoggerFactory.createLogger(`TaskExecutor.RouterServer:${network || ''}`, 'Common');
  const BlockchainRepositoryLogger = LoggerFactory.createLogger(`RouterServer:${network || ''}`, 'BlockchainRepository');

  const { linkRpcProvider } = configRouterServer.configForNetwork();
  const ethNetworks = [BlockchainNetworks.rinkebyTestNetwork, BlockchainNetworks.ethMainNetwork];

  if (!network) {
    throw new Error('Network argv is undefined. Use arg --network=NetworkName');
  }
  if (!ethNetworks.includes(network)) {
    throw new Error('Use only eth networks.');
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

  const blockchainRepository = new BlockchainRepositoryWithCachingAddresses(
    web3,
    BlockchainRepositoryLogger,
    ethContractTrackingAddresses(),
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

  const routerServer = await new RouterMQServer(
    configRouterServices.messageOriented.routerServerMessageBrokerLink,
    network,
    ServerRouterServices.TaskExecutor,
  )
    .on('error', (error) => {
      Logger.error(error, 'RouterMQServer stopped with error.');
      process.exit(-1);
    })
    .init()

  await new BlockchainTaskExecutorServer(
    routerServer,
    tasksFactory,
    tasksExecutor,
  )
    .start()
}

init().catch((error) => {
  console.error(error);
  process.exit(-1);
})
