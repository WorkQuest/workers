import Web3 from "web3";
import configBridge from "./config/config.bridge";
import configServices from "./config/config.services";
import {getBridgeContractDataByNetwork} from "./src/utils";
import {BridgeController} from "./src/controllers/BridgeController";
import {SupervisorContractTasks} from "../middleware/middleware.types"
import {BlockchainNetworks, initDatabase} from "@workquest/database-models/lib/models";
import {ContractRpcProvider, ContractSupervisor, LoggerFactory, NotificationMQSenderClient} from "../middleware";

async function init() {
  const network = configBridge.network() as BlockchainNetworks;
  const { linkRpcProvider } = configBridge.configForNetwork();

  const Logger = LoggerFactory.createLogger(`WorkerBridge:${network || ''}`, 'Common');
  const BridgeProviderLogger = LoggerFactory.createLogger(`WorkerBridge:${network || ''}`, 'RpcProvider');
  const BridgeControllerLogger = LoggerFactory.createLogger(`WorkerBridge:${network || ''}`, 'BridgeController');
  const BridgeContractSupervisorLogger = LoggerFactory.createLogger(`WorkerBridge:${network || ''}`, 'BridgeSupervisor');

  const web3 = new Web3(new Web3.providers.HttpProvider(linkRpcProvider));

  const bridgeContractData = getBridgeContractDataByNetwork(network);
  const bridgeContract = new web3.eth.Contract(bridgeContractData.getAbi(), bridgeContractData.address);

  await initDatabase(configServices.database.postgresLink, false, false);

  const notificationSenderClient = await new NotificationMQSenderClient(configServices.messageOriented.notificationMessageBrokerLink, 'bridge')
    .on('error', (error) => {
      Logger.error(error, 'Notification client stopped with error');
      process.exit(-1);
    })
    .init()

  const bridgeProvider = new ContractRpcProvider(
    bridgeContractData.address,
    bridgeContractData.deploymentHeight,
    web3,
    bridgeContract,
    BridgeProviderLogger,
    { stepsRange: 2000 }
  );

  const bridgeController = new BridgeController(
    BridgeControllerLogger,
    network,
    bridgeProvider,
    notificationSenderClient,
  );

  await new ContractSupervisor(
    BridgeContractSupervisorLogger,
    bridgeController,
    { blockHeightSync: { pollPeriod: 4000 } },
    bridgeProvider,
  )
    .startTasks(SupervisorContractTasks.BlockHeightSync)
}

init().catch((error) => {
  console.error(error);
  process.exit(-1);
});
