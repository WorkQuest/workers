import Web3 from "web3";
import configServices from "./config/config.services";
import configBridgeUsdt from "./config/config.bridge-usdt";
import {getBridgeUsdtContractDataByNetwork} from "./src/utils";
import {SupervisorContractTasks} from "../middleware/middleware.types"
import {BridgeUsdtController} from "./src/controllers/BridgeUsdtController";
import {ContractRpcProvider, ContractSupervisor, LoggerFactory} from "../middleware";
import {BlockchainNetworks, initDatabase} from "@workquest/database-models/lib/models";
import {OraclePricesProvider} from "./src/providers/OraclePricesProvider";

async function init() {
  const network = configBridgeUsdt.network() as BlockchainNetworks;

  if (!network) {
    throw new Error('Network argv is undefined. Use arg --network=NetworkName');
  }

  await initDatabase(configServices.database.postgresLink, false, false);

  const { linkRpcProvider } = configBridgeUsdt.configForNetwork();

  const Logger = LoggerFactory.createLogger(`WorkerBridgeUsdt:${network || ''}`, 'Common');
  const BridgeProviderLogger = LoggerFactory.createLogger(`WorkerBridgeUsdt:${network || ''}`, 'RpcProvider');
  const BridgeControllerLogger = LoggerFactory.createLogger(`WorkerBridgeUsdt:${network || ''}`, 'BridgeController');
  const BridgeContractSupervisorLogger = LoggerFactory.createLogger(`WorkerBridgeUsdt:${network || ''}`, 'BridgeSupervisor');

  const web3 = new Web3(new Web3.providers.HttpProvider(linkRpcProvider));

  const bridgeContractData = getBridgeUsdtContractDataByNetwork(network);
  const bridgeContract = new web3.eth.Contract(bridgeContractData.getAbi(), bridgeContractData.address);

  await initDatabase(configServices.database.postgresLink, false, false);

  const oracleProvider = new OraclePricesProvider(configServices.oracleLink);

  const bridgeProvider = new ContractRpcProvider(
    bridgeContractData.address,
    bridgeContractData.deploymentHeight,
    web3,
    bridgeContract,
    BridgeProviderLogger,
    { stepsRange: 2000 }
  );

  const bridgeController = new BridgeUsdtController(
    BridgeControllerLogger,
    network,
    bridgeProvider,
    oracleProvider,
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
