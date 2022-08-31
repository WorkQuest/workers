import configBridge from "./config/config.bridge";
import configServices from "./config/config.services";
import {getBridgeContractDataByNetwork} from "./src/utils";
import {BridgeRouterController} from "./src/controllers/BridgeController";
import {BlockchainNetworks, initDatabase} from "@workquest/database-models/lib/models";
import {SupervisorContractTasks} from "../middleware/contract-controllers/contract-controllers.types";
import {
  LoggerFactory,
  RouterMQClient,
  ContractSupervisor,
  ContractRouterProvider,
  NotificationMQSenderClient,
} from "../middleware";

export async function init() {
  const network = configBridge.network() as BlockchainNetworks;

  if (!network) {
    throw new Error('Network argv is undefined. Use arg --network=NetworkName');
  }

  await initDatabase(configServices.database.postgresLink, false, false);

  const Logger = LoggerFactory.createLogger(`WorkerBridge:${network || ''}`, 'Common');
  const BridgeRouterProviderLogger = LoggerFactory.createLogger(`WorkerBridge:${network || ''}`, 'RouterProvider');
  const BridgeControllerLogger = LoggerFactory.createLogger(`WorkerBridge:${network || ''}`, 'BridgeController');
  const BridgeContractSupervisorLogger = LoggerFactory.createLogger(`WorkerBridge:${network || ''}`, 'BridgeSupervisor');

  const bridgeContractData = getBridgeContractDataByNetwork(network);

  const bridgeRouterClient = await new RouterMQClient(
    configServices.messageOriented.routerClientMessageBrokerLink,
    'Bridge',
    network,
  )
    .on('error', error => {
      Logger.error(error, 'RouterClient stopped with error.');
      process.exit(-1);
    })
    .init()

  const notificationSenderClient = await new NotificationMQSenderClient(configServices.messageOriented.notificationMessageBrokerLink, 'bridge')
    .on('error', error => {
      Logger.error(error, 'Notification client stopped with error');
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

  const bridgeController = new BridgeRouterController(
    BridgeControllerLogger,
    network,
    bridgeProvider,
    notificationSenderClient,
  );

  await new ContractSupervisor(
    BridgeContractSupervisorLogger,
    bridgeController,
    { blockHeightSync: { pollPeriod: 25000 } },
    bridgeProvider,
  )
    .startTasks(SupervisorContractTasks.BlockHeightSync)
}

init().catch((error) => {
  console.error(error);
  process.exit(-1);
});
