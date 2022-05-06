import fs from "fs";
import Web3 from "web3";
import path from "path";
import { Logger } from "./logger/pino";
import configBridgeUSDT from "./config/config.bridgeUSDT";
import configDatabase from "../bridgeUSDT/config/config.common";
import { BridgeUSDTProvider } from "./src/providers/BridgeUSDTProvider";
import { BridgeUSDTController } from "./src/controllers/BridgeUSDTController";
import { BridgeUSDTEthClients, BridgeUSDTWorkNetClients } from "./src/providers/types";
import { BridgeUSDTWorkNetProvider } from "./src/providers/BridgeWorkNetProvider";
import { TransactionBroker } from "../brokers/src/TransactionBroker";
import { NotificationBroker } from "../brokers/src/NotificationBroker";
import {
  initDatabase,
  BlockchainNetworks,
  BridgeParserBlockInfo,
} from "@workquest/database-models/lib/models";

const abiFilePath = path.join(__dirname, '../../src/bridgeUSDT/abi/BridgeUSDT.json');
const abi: any[] = JSON.parse(fs.readFileSync(abiFilePath).toString()).abi;

export async function init() {
  await initDatabase(configDatabase.database.link, false, false);

  const networks = [
    configBridgeUSDT.bscNetwork,
    configBridgeUSDT.ethereumNetwork,
    configBridgeUSDT.workQuestNetwork,
    configBridgeUSDT.polygonscanNetwork
  ];

  Logger.debug('Binance smart chain network "%s"', configBridgeUSDT.bscNetwork);
  Logger.debug('Ethereum network "%s"', configBridgeUSDT.ethereumNetwork);
  Logger.debug('WorkQuest network "%s"', configBridgeUSDT.workQuestNetwork);
  Logger.debug('Polygon network "%s"', configBridgeUSDT.polygonscanNetwork);

  const wqDefaultConfig = configBridgeUSDT.defaultWqConfigNetwork();
  const bscDefaultConfig = configBridgeUSDT.defaultBscConfigNetwork();
  const ethDefaultConfig = configBridgeUSDT.defaultEthConfigNetwork();
  const polygonDefaultConfig = configBridgeUSDT.defaultPolygonConfigNetwork();

  Logger.debug('WorkQuest network: link Rpc provider "%s"', wqDefaultConfig.linkRpcProvider);

  const wqRpcProvider = new Web3.providers.HttpProvider(wqDefaultConfig.linkRpcProvider);

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

  const web3Wq = new Web3(wqRpcProvider);
  const web3Bsc = new Web3(bscWsProvider);
  const web3Eth = new Web3(ethWsProvider);
  const web3Polygon = new Web3(polygonWsProvider);

  const transactionsBroker = new TransactionBroker(configDatabase.mqLink, 'bridgeUSDT');
  await transactionsBroker.init();

  const notificationsBroker = new NotificationBroker(configDatabase.notificationMessageBroker.link, 'bridgeUSDT');
  // await notificationsBroker.init();

  const bridgeUSDTWqContract = new web3Wq.eth.Contract(abi, wqDefaultConfig.contractAddress);
  const bridgeUSDTBscContract = new web3Bsc.eth.Contract(abi, bscDefaultConfig.contractAddress);
  const bridgeUSDTEthContract = new web3Eth.eth.Contract(abi, ethDefaultConfig.contractAddress);
  const bridgeUSDTPolygonContract = new web3Polygon.eth.Contract(abi, polygonDefaultConfig.contractAddress);

  Logger.debug('WorkQuest network contract address: "%s"', wqDefaultConfig.contractAddress);
  Logger.debug('Binance smart chain contract address: "%s"', bscDefaultConfig.contractAddress);
  Logger.debug('Ethereum network contract address: "%s"', ethDefaultConfig.contractAddress);
  Logger.debug('Polygon network contract address: "%s"', polygonDefaultConfig.contractAddress);

  const wqClients: BridgeUSDTWorkNetClients = { web3: web3Wq, transactionsBroker, notificationsBroker };
  const bscClients: BridgeUSDTEthClients = { web3: web3Bsc, webSocketProvider: bscWsProvider, notificationsBroker };
  const ethClients: BridgeUSDTEthClients = { web3: web3Eth, webSocketProvider: ethWsProvider, notificationsBroker };
  const polygonClients: BridgeUSDTEthClients = { web3: web3Polygon, webSocketProvider: polygonWsProvider, notificationsBroker };

  const wqBridgeProvider = new BridgeUSDTWorkNetProvider(wqClients, bridgeUSDTWqContract);
  const bscBridgeProvider = new BridgeUSDTProvider(bscClients, bridgeUSDTBscContract);
  const ethBridgeProvider = new BridgeUSDTProvider(ethClients, bridgeUSDTEthContract);
  const polygonBridgeProvider = new BridgeUSDTProvider(polygonClients, bridgeUSDTPolygonContract);

  const wqBridgeController = new BridgeUSDTController(
    wqClients,
    configBridgeUSDT.workQuestNetwork as BlockchainNetworks,
    wqBridgeProvider,
  );
  const bscBridgeController = new BridgeUSDTController(
    bscClients,
    configBridgeUSDT.bscNetwork as BlockchainNetworks,
    bscBridgeProvider,
  );
  const ethBridgeController = new BridgeUSDTController(
    ethClients,
    configBridgeUSDT.ethereumNetwork as BlockchainNetworks,
    ethBridgeProvider,
  );
  const polygonBridgeController = new BridgeUSDTController(
    polygonClients,
    configBridgeUSDT.polygonscanNetwork as BlockchainNetworks,
    polygonBridgeProvider,
  );

  const blockInfos = new Map<string, number>();

  for (const network of networks) {
    const [bridgeUSDTBlockInfo] = await BridgeParserBlockInfo.findOrCreate({
      where: { network },
      defaults: { network, lastParsedBlock: configBridgeUSDT[network].parseEventsFromHeight }
    });

    if (bridgeUSDTBlockInfo.lastParsedBlock < configBridgeUSDT[network].parseEventsFromHeight) {
      await bridgeUSDTBlockInfo.update({
        lastParsedBlock: configBridgeUSDT[network].parseEventsFromHeight,
      });
    }

    blockInfos.set(network, bridgeUSDTBlockInfo.lastParsedBlock);
  }

  await Promise.all([
    wqBridgeController.collectAllUncollectedEvents(blockInfos.get(configBridgeUSDT.workQuestNetwork)),
    bscBridgeController.collectAllUncollectedEvents(blockInfos.get(configBridgeUSDT.bscNetwork)),
    ethBridgeController.collectAllUncollectedEvents(blockInfos.get(configBridgeUSDT.ethereumNetwork)),
    polygonBridgeController.collectAllUncollectedEvents(blockInfos.get(configBridgeUSDT.polygonscanNetwork)),
  ]);

  await wqBridgeProvider.startListener();
  bscBridgeProvider.startListener();
  ethBridgeProvider.startListener();
  polygonBridgeProvider.startListener();
}

init().catch(e => {
  Logger.error(e, 'Worker "BridgeUSDT" is stopped with error');
  process.exit(-1);
});
