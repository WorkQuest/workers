import Web3 from "web3";
import {run} from 'graphile-worker';
import {Logger} from "./logger/pino";
import {SupervisorContract, SupervisorContractTasks} from "../supervisor";
import configDatabase from ".//config/config.common";
import configSwapUsdt from "./config/config.swapUsdt";
import {SwapUsdtEthClients} from "./src/providers/types";
import {BridgeUsdtRpcProvider} from "./src/providers/BridgeUsdtProvider";
import {NotificationBroker} from "../brokers/src/NotificationBroker";
import {BridgeUsdtController} from "./src/controllers/BridgeUsdtController";
import {OraclePricesProvider} from "./src/providers/OraclePricesProvider";
import {
  initDatabase,
  BlockchainNetworks,
} from "@workquest/database-models/lib/models";
import {
  Store,
  Networks,
  BnbNetworkContracts,
  EthNetworkContracts,
  PolygonScanContracts,
} from "@workquest/contract-data-pools";

export async function init() {
  const contractEthData = Store[Networks.Eth][EthNetworkContracts.BridgeUSDT];
  const contractBnbData = Store[Networks.Bnb][BnbNetworkContracts.BridgeUSDT];
  const contractPolygonScanData = Store[Networks.PolygonScan][PolygonScanContracts.BridgeUSDT];

  await initDatabase(configDatabase.database.link, false, false);

  await run({
    connectionString: configDatabase.database.link,
    concurrency: 1,
    pollInterval: 60000,
    schema: 'worker_token_swap_txs',
    taskDirectory: `${__dirname}/jobs`, // Папка с исполняемыми тасками.
  });

  Logger.debug('Ethereum network "%s"', configSwapUsdt.ethereumNetwork);
  Logger.debug('Polygon network "%s"', configSwapUsdt.polygonscanNetwork);
  Logger.debug('Binance smart chain network "%s"', configSwapUsdt.bscNetwork);

  const wqDefaultConfig = configSwapUsdt.defaultWqConfigNetwork();
  const bscDefaultConfig = configSwapUsdt.defaultBscConfigNetwork();
  const ethDefaultConfig = configSwapUsdt.defaultEthConfigNetwork();
  const polygonDefaultConfig = configSwapUsdt.defaultPolygonConfigNetwork();

  Logger.debug('WorkQuest network: link Rpc provider "%s"', wqDefaultConfig.linkRpcProvider);

  const bscRpcProvider = new Web3.providers.HttpProvider(bscDefaultConfig.linkRpcProvider);
  const ethRpcProvider = new Web3.providers.HttpProvider(ethDefaultConfig.linkRpcProvider);
  const polygonRpcProvider = new Web3.providers.HttpProvider(polygonDefaultConfig.linkRpcProvider);

  const web3Bsc = new Web3(bscRpcProvider);
  const web3Eth = new Web3(ethRpcProvider);
  const web3Polygon = new Web3(polygonRpcProvider);

  const notificationsBroker = new NotificationBroker(configDatabase.notificationMessageBroker.link, 'SwapUsdt');

  const SwapUsdtBscContract = new web3Bsc.eth.Contract(contractBnbData.getAbi(), contractBnbData.address);
  const SwapUsdtEthContract = new web3Eth.eth.Contract(contractEthData.getAbi(), contractEthData.address);
  const SwapUsdtPolygonContract = new web3Polygon.eth.Contract(contractPolygonScanData.getAbi(), contractPolygonScanData.address);

  Logger.debug('Binance smart chain contract address: "%s"', contractBnbData.address);
  Logger.debug('Ethereum network contract address: "%s"', contractEthData.address);
  Logger.debug('Polygon network contract address: "%s"', contractPolygonScanData.address);

  const bscClients: SwapUsdtEthClients = { web3: web3Bsc, webSocketProvider: bscRpcProvider, notificationsBroker };
  const ethClients: SwapUsdtEthClients = { web3: web3Eth, webSocketProvider: ethRpcProvider, notificationsBroker };
  const polygonClients: SwapUsdtEthClients = { web3: web3Polygon, webSocketProvider: polygonRpcProvider, notificationsBroker };

  const oracleProvider = new OraclePricesProvider(configSwapUsdt.oracleLink);

  const bscSwapUsdtProvider = new BridgeUsdtRpcProvider(
    contractBnbData.address,
    contractBnbData.deploymentHeight,
    SwapUsdtBscContract,
    web3Bsc,
  );
  const ethSwapUsdtProvider = new BridgeUsdtRpcProvider(
    contractEthData.address,
    contractEthData.deploymentHeight,
    SwapUsdtEthContract,
    web3Eth,
  );
  const polygonSwapUsdtProvider = new BridgeUsdtRpcProvider(
    contractPolygonScanData.address,
    contractPolygonScanData.deploymentHeight,
    SwapUsdtPolygonContract,
    web3Polygon,
  );

  const bscBridgeController = new BridgeUsdtController(
    bscClients,
    configSwapUsdt.bscNetwork as BlockchainNetworks,
    oracleProvider,
    bscSwapUsdtProvider,
  );
  const ethBridgeController = new BridgeUsdtController(
    ethClients,
    configSwapUsdt.ethereumNetwork as BlockchainNetworks,
    oracleProvider,
    ethSwapUsdtProvider,
  );
  const polygonBridgeController = new BridgeUsdtController(
    polygonClients,
    configSwapUsdt.polygonscanNetwork as BlockchainNetworks,
    oracleProvider,
    polygonSwapUsdtProvider,
  );

  await new SupervisorContract(
    Logger,
    bscBridgeController,
    bscSwapUsdtProvider,
  )
  .setHeightSyncOptions({ period: 15000 })
  .startTasks(SupervisorContractTasks.BlockHeightSync)

  await new SupervisorContract(
    Logger,
    ethBridgeController,
    ethSwapUsdtProvider,
  )
  .setHeightSyncOptions({ period: 15000 })
  .startTasks(SupervisorContractTasks.BlockHeightSync)

  await new SupervisorContract(
    Logger,
    polygonBridgeController,
    polygonSwapUsdtProvider,
  )
  .setHeightSyncOptions({ period: 15000 })
  .startTasks(SupervisorContractTasks.BlockHeightSync)
}

init().catch(e => {
  Logger.error(e, 'Worker "SwapUsdt" is stopped with error');
  process.exit(-1);
});
