import Web3 from "web3";
import configRouterServices from "./config/config.services";
import configRouterServer from "./config/config.router-server";
import {ServerRouterServices} from "../middleware/middleware.types"
import {BlockchainNetworks} from "@workquest/database-models/lib/models";
import {EthNetworkContracts, Networks, Store} from "@workquest/contract-data-pools";
import {BlockchainNewLogNotificationsServer} from "./src/BlockchainNewLogNotificationsServer";
import {
  LoggerFactory,
  RouterMQServer,
  LogsFetcherWorker,
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
  const network = configRouterServer.network() as BlockchainNetworks.ethMainNetwork | BlockchainNetworks.rinkebyTestNetwork;

  const Logger = LoggerFactory.createLogger(`LogsFetcher.RouterServer:${network || ''}`, 'Common');
  const BlockchainRepositoryLogger = LoggerFactory.createLogger(`RouterServer:${network || ''}`, 'BlockchainRepository');

  const { linkRpcProvider } = configRouterServer.configForNetwork();
  const ethNetworks = [BlockchainNetworks.ethMainNetwork, BlockchainNetworks.rinkebyTestNetwork];

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
      Logger.error(error, 'EventLogsRedisRepository stopped with error');
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
