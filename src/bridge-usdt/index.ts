import Web3 from "web3";
import {run} from 'graphile-worker';
import {Logger} from "./logger/pino";
import configDatabase from ".//config/config.common";
import configSwapUsdt from "./config/config.swapUsdt";
import {BridgeUsdtProvider} from "./src/providers/BridgeUsdtProvider";
import {SupervisorContract, SupervisorContractTasks} from "../supervisor";
import {OraclePricesProvider} from "./src/providers/OraclePricesProvider";
import {BridgeUsdtController} from "./src/controllers/BridgeUsdtController";
import {initDatabase, BlockchainNetworks} from "@workquest/database-models/lib/models";
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

  const SwapUsdtBscContract = new web3Bsc.eth.Contract(contractBnbData.getAbi(), contractBnbData.address);
  const SwapUsdtEthContract = new web3Eth.eth.Contract(contractEthData.getAbi(), contractEthData.address);
  const SwapUsdtPolygonContract = new web3Polygon.eth.Contract(contractPolygonScanData.getAbi(), contractPolygonScanData.address);

  Logger.debug('Binance smart chain contract address: "%s"', contractBnbData.address);
  Logger.debug('Ethereum network contract address: "%s"', contractEthData.address);
  Logger.debug('Polygon network contract address: "%s"', contractPolygonScanData.address);

  const oracleProvider = new OraclePricesProvider(configSwapUsdt.oracleLink);

  const bscSwapUsdtProvider = new BridgeUsdtProvider(
    contractBnbData.address,
    contractBnbData.deploymentHeight,
    SwapUsdtBscContract,
    web3Bsc,
    Logger.child({
      target: `BridgeUsdtProvider ("${configSwapUsdt.bscNetwork})"`,
    }),
  );
  const ethSwapUsdtProvider = new BridgeUsdtProvider(
    contractEthData.address,
    contractEthData.deploymentHeight,
    SwapUsdtEthContract,
    web3Eth,
    Logger.child({
      target: `BridgeUsdtProvider ("${configSwapUsdt.ethereumNetwork})"`,
    }),
  );
  const polygonSwapUsdtProvider = new BridgeUsdtProvider(
    contractPolygonScanData.address,
    contractPolygonScanData.deploymentHeight,
    SwapUsdtPolygonContract,
    web3Polygon,
    Logger.child({
      target: `BridgeUsdtProvider ("${configSwapUsdt.polygonscanNetwork})"`,
    }),
  );

  const bscBridgeController = new BridgeUsdtController(
    Logger.child({
      target: `BridgeUsdtController ("${configSwapUsdt.bscNetwork})"`,
    }),
    configSwapUsdt.bscNetwork as BlockchainNetworks,
    bscSwapUsdtProvider,
    oracleProvider,
  );
  const ethBridgeController = new BridgeUsdtController(
    Logger.child({
      target: `BridgeUsdtController ("${configSwapUsdt.ethereumNetwork})"`,
    }),
    configSwapUsdt.ethereumNetwork as BlockchainNetworks,
    ethSwapUsdtProvider,
    oracleProvider,
  );
  const polygonBridgeController = new BridgeUsdtController(
    Logger.child({
      target: `BridgeUsdtController ("${configSwapUsdt.polygonscanNetwork})"`,
    }),
    configSwapUsdt.polygonscanNetwork as BlockchainNetworks,
    polygonSwapUsdtProvider,
    oracleProvider,
  );

  await new SupervisorContract(
    Logger.child({
      target: `SupervisorContract ("${configSwapUsdt.bscNetwork})"`,
    }),
    bscBridgeController,
    bscSwapUsdtProvider,
  )
  .setHeightSyncOptions({ period: 10000 })
  .startTasks(SupervisorContractTasks.BlockHeightSync)

  await new SupervisorContract(
    Logger.child({
      target: `SupervisorContract ("${configSwapUsdt.ethereumNetwork})"`,
    }),
    ethBridgeController,
    ethSwapUsdtProvider,
  )
  .setHeightSyncOptions({ period: 10000 })
  .startTasks(SupervisorContractTasks.BlockHeightSync)

  await new SupervisorContract(
    Logger.child({
      target: `SupervisorContract ("${configSwapUsdt.polygonscanNetwork})"`,
    }),
    polygonBridgeController,
    polygonSwapUsdtProvider,
  )
  .setHeightSyncOptions({ period: 10000 })
  .startTasks(SupervisorContractTasks.BlockHeightSync)
}

init().catch(e => {
  Logger.error(e, 'Worker "SwapUsdt" is stopped with error');
  process.exit(-1);
});
