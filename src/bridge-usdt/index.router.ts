import {run} from "graphile-worker";
import configServices from "./config/config.services";
import configBridgeUsdt from "./config/config.bridge-usdt";
import {getBridgeUsdtContractDataByNetwork} from "./src/utils";
import {OraclePricesProvider} from "./src/providers/OraclePricesProvider";
import {BridgeUsdtRouterController} from "./src/controllers/BridgeUsdtController";
import {BlockchainNetworks, initDatabase} from "@workquest/database-models/lib/models";
import {SupervisorContractTasks} from "../middleware/contract-controllers/contract-controllers.types";
import {
  LoggerFactory,
  RouterMQClient,
  ContractSupervisor,
  ContractRouterProvider,
} from "../middleware";

export async function init() {
  const network = configBridgeUsdt.network() as BlockchainNetworks;

  if (!network) {
    throw new Error('Network argv is undefined. Use arg --network=NetworkName');
  }

  await initDatabase(configServices.database.postgresLink, false, false);

  await run({
    connectionString: configServices.database.postgresLink,
    concurrency: 1,
    pollInterval: 60000,
    schema: 'worker_token_swap_txs',
    taskDirectory: `${__dirname}/jobs`, // Папка с исполняемыми тасками.
  });

  const Logger = LoggerFactory.createLogger(`WorkerUsdtBridge:${network || ''}`, 'Common');
  const BridgeRouterProviderLogger = LoggerFactory.createLogger(`WorkerUsdtBridge:${network || ''}`, 'RouterProvider');
  const BridgeControllerLogger = LoggerFactory.createLogger(`WorkerUsdtBridge:${network || ''}`, 'BridgeUsdtController');
  const BridgeContractSupervisorLogger = LoggerFactory.createLogger(`WorkerUsdtBridge:${network || ''}`, 'BridgeUsdtSupervisor');

  const bridgeContractData = getBridgeUsdtContractDataByNetwork(network);

  const oracleProvider = new OraclePricesProvider(configServices.oracleLink);

  const bridgeRouterClient = await new RouterMQClient(
    configServices.messageOriented.routerClientMessageBrokerLink,
    'BridgeUsdt',
    network,
  )
    .on('error', error => {
      Logger.error(error, 'RouterClient stopped with error.');
      process.exit(-1);
    })
    .init()

  const bridgeProvider = new ContractRouterProvider(
    bridgeContractData.address,
    bridgeContractData.deploymentHeight,
    bridgeContractData.getAbi(),
    BridgeRouterProviderLogger,
    bridgeRouterClient,
  )
    .startListener()

  const bridgeController = new BridgeUsdtRouterController(
    BridgeControllerLogger,
    network,
    oracleProvider,
    bridgeProvider,
  );

  await new ContractSupervisor(
    BridgeContractSupervisorLogger,
    bridgeController,
    { blockHeightSync: { pollPeriod: 7000 } },
    bridgeProvider,
  )
    .startTasks(SupervisorContractTasks.BlockHeightSync)
}

init().catch((error) => {
  console.error(error);
  process.exit(-1);
});
