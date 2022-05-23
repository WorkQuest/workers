import fs from "fs";
import Web3 from "web3";
import path from "path";
import { run } from 'graphile-worker';
import { Logger } from "./logger/pino";
import configDatabase from ".//config/config.common";
import configSwapUsdt from "./config/config.swapUsdt";
import { SwapUsdtProvider } from "./src/providers/SwapUsdtProvider";
import { NotificationBroker } from "../brokers/src/NotificationBroker";
import { SwapUsdtController } from "./src/controllers/SwapUsdtController";
import { OraclePricesProvider } from "./src/providers/OraclePricesProvider";
import { SwapUsdtEthClients } from "./src/providers/types";
import {
  initDatabase,
  BlockchainNetworks,
  BridgeSwapUsdtParserBlockInfo,
} from "@workquest/database-models/lib/models";

const abiFilePath = path.join(__dirname, '../../src/bridge-usdt/abi/BridgeUsdt.json');
const abi: any[] = JSON.parse(fs.readFileSync(abiFilePath).toString()).abi;

export async function init() {
  await initDatabase(configDatabase.database.link, false, true);

  await run({
    connectionString: configDatabase.database.link,
    concurrency: 1,
    pollInterval: 60000,
    schema: 'worker_token_swap_txs',
    taskDirectory: `${__dirname}/jobs`, // Папка с исполняемыми тасками.
  });

  const networksPayload = {
    [configSwapUsdt.bscNetwork]: {},
    [configSwapUsdt.ethereumNetwork]: {},
    [configSwapUsdt.polygonscanNetwork]: {},
  }

  Logger.debug('Ethereum network "%s"', configSwapUsdt.ethereumNetwork);
  Logger.debug('Polygon network "%s"', configSwapUsdt.polygonscanNetwork);
  Logger.debug('Binance smart chain network "%s"', configSwapUsdt.bscNetwork);

  const wqDefaultConfig = configSwapUsdt.defaultWqConfigNetwork();
  const bscDefaultConfig = configSwapUsdt.defaultBscConfigNetwork();
  const ethDefaultConfig = configSwapUsdt.defaultEthConfigNetwork();
  const polygonDefaultConfig = configSwapUsdt.defaultPolygonConfigNetwork();

  Logger.debug('WorkQuest network: link Rpc provider "%s"', wqDefaultConfig.linkRpcProvider);

  const bscWsProvider = new Web3.providers.WebsocketProvider(bscDefaultConfig.linkWsProvider, {
    clientConfig: {
      keepalive: true,
      keepaliveInterval: 60000, // ms
    },
    reconnect: {
      auto: true,
      delay: 1000, // ms
      onTimeout: false,
    },
  });

  const ethWsProvider = new Web3.providers.WebsocketProvider(ethDefaultConfig.linkWsProvider, {
    clientConfig: {
      keepalive: true,
      keepaliveInterval: 60000, // ms
    },
    reconnect: {
      auto: true,
      delay: 1000, // ms
      onTimeout: false,
    },
  });

  const polygonWsProvider = new Web3.providers.WebsocketProvider(polygonDefaultConfig.linkWsProvider, {
    clientConfig: {
      keepalive: true,
      keepaliveInterval: 60000, // ms
    },
    reconnect: {
      auto: true,
      delay: 1000, // ms
      onTimeout: false,
    },
  })

  const web3Bsc = new Web3(bscWsProvider);
  const web3Eth = new Web3(ethWsProvider);
  const web3Polygon = new Web3(polygonWsProvider);

  const notificationsBroker = new NotificationBroker(configDatabase.notificationMessageBroker.link, 'SwapUsdt');

  const SwapUsdtBscContract = new web3Bsc.eth.Contract(abi, bscDefaultConfig.contractAddress);
  const SwapUsdtEthContract = new web3Eth.eth.Contract(abi, ethDefaultConfig.contractAddress);
  const SwapUsdtPolygonContract = new web3Polygon.eth.Contract(abi, polygonDefaultConfig.contractAddress);

  Logger.debug('Binance smart chain contract address: "%s"', bscDefaultConfig.contractAddress);
  Logger.debug('Ethereum network contract address: "%s"', ethDefaultConfig.contractAddress);
  Logger.debug('Polygon network contract address: "%s"', polygonDefaultConfig.contractAddress);

  const bscClients: SwapUsdtEthClients = { web3: web3Bsc, webSocketProvider: bscWsProvider, notificationsBroker };
  const ethClients: SwapUsdtEthClients = { web3: web3Eth, webSocketProvider: ethWsProvider, notificationsBroker };
  const polygonClients: SwapUsdtEthClients = { web3: web3Polygon, webSocketProvider: polygonWsProvider, notificationsBroker };

  const bscSwapUsdtProvider = new SwapUsdtProvider(bscClients, SwapUsdtBscContract);
  const ethSwapUsdtProvider = new SwapUsdtProvider(ethClients, SwapUsdtEthContract);
  const polygonSwapUsdtProvider = new SwapUsdtProvider(polygonClients, SwapUsdtPolygonContract);

  const oracleProvider = new OraclePricesProvider(configSwapUsdt.oracleLink)

  const bscBridgeController = new SwapUsdtController(
    bscClients,
    configSwapUsdt.bscNetwork as BlockchainNetworks,
    bscSwapUsdtProvider,
    oracleProvider,
  );
  const ethBridgeController = new SwapUsdtController(
    ethClients,
    configSwapUsdt.ethereumNetwork as BlockchainNetworks,
    ethSwapUsdtProvider,
    oracleProvider,
  );
  const polygonBridgeController = new SwapUsdtController(
    polygonClients,
    configSwapUsdt.polygonscanNetwork as BlockchainNetworks,
    polygonSwapUsdtProvider,
    oracleProvider,
  );

  for (const network in networksPayload) {
    const [swapUsdtBlockInfo] = await BridgeSwapUsdtParserBlockInfo.findOrCreate({
      where: { network },
      defaults: { network, lastParsedBlock: configSwapUsdt[network].parseEventsFromHeight }
    });

    networksPayload[network]['lastParsedBlock'] = swapUsdtBlockInfo.lastParsedBlock;
  }

  await Promise.all([
    bscBridgeController.collectAllUncollectedEvents(networksPayload[configSwapUsdt.bscNetwork]['lastParsedBlock']),
    ethBridgeController.collectAllUncollectedEvents(networksPayload[configSwapUsdt.ethereumNetwork]['lastParsedBlock']),
    polygonBridgeController.collectAllUncollectedEvents(networksPayload[configSwapUsdt.polygonscanNetwork]['lastParsedBlock']),
  ]);

  bscSwapUsdtProvider.startListener();
  ethSwapUsdtProvider.startListener();
  polygonSwapUsdtProvider.startListener();
}

init().catch(e => {
  Logger.error(e, 'Worker "SwapUsdt" is stopped with error');
  process.exit(-1);
});
