import fs from "fs";
import Web3 from "web3";
import path from "path";
import { Logger } from "./logger/pino";
import { Clients } from "./src/providers/types";
import configBridge from "./config/config.bridge";
import configDatabase from "../bridge/config/config.common";
import { BridgeProvider } from "./src/providers/BridgeProvider";
import { BridgeController } from "./src/controllers/BridgeController";
import { BridgeMessageBroker } from "./src/controllers/BrokerController";
import { BridgeBrokerProvider } from "./src/providers/BridgeBrokerProvider";
import { TransactionBroker } from "../brokers/src/TransactionBroker";
import {
  initDatabase,
  BlockchainNetworks,
  BridgeParserBlockInfo,
} from "@workquest/database-models/lib/models";

const abiFilePath = path.join(__dirname, '../../src/bridge/abi/WQBridge.json');
const abi: any[] = JSON.parse(fs.readFileSync(abiFilePath).toString()).abi;

export async function init() {
  await initDatabase(configDatabase.database.link, false, false);

  BridgeMessageBroker.initMessageBroker();

  const networks = [configBridge.bscNetwork, configBridge.ethereumNetwork, configBridge.workQuestNetwork];

  Logger.debug('Binance smart chain network "%s"', configBridge.bscNetwork);
  Logger.debug('Ethereum network "%s"', configBridge.ethereumNetwork);
  Logger.debug('WorkQuest network "%s"', configBridge.workQuestNetwork);

  const wqDefaultConfig = configBridge.defaultWqConfigNetwork();
  const bscDefaultConfig = configBridge.defaultBscConfigNetwork();
  const ethDefaultConfig = configBridge.defaultEthConfigNetwork();

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
  })

  const web3Wq = new Web3(wqRpcProvider);
  const web3Bsc = new Web3(bscWsProvider);
  const web3Eth = new Web3(ethWsProvider);

  const transactionsBroker = new TransactionBroker(configDatabase.mqLink, 'bridge');
  await transactionsBroker.init();

  const bridgeWqContract = new web3Wq.eth.Contract(abi, wqDefaultConfig.contractAddress);
  const bridgeBscContract = new web3Bsc.eth.Contract(abi, bscDefaultConfig.contractAddress);
  const bridgeEthContract = new web3Eth.eth.Contract(abi, ethDefaultConfig.contractAddress);

  Logger.debug('WorkQuest network contract address: "%s"', wqDefaultConfig.contractAddress);
  Logger.debug('Binance smart chain contract address: "%s"', bscDefaultConfig.contractAddress);
  Logger.debug('Ethereum network contract address: "%s"', ethDefaultConfig.contractAddress);

  const wqClients: Clients = { web3: web3Wq, transactionsBroker };
  const bscClients: Clients = { web3: web3Bsc, webSocketProvider: bscWsProvider };
  const ethClients: Clients = { web3: web3Eth, webSocketProvider: ethWsProvider };

  const wqBridgeProvider = new BridgeBrokerProvider(wqClients, bridgeWqContract);
  const bscBridgeProvider = new BridgeProvider(bscClients, bridgeBscContract);
  const ethBridgeProvider = new BridgeProvider(ethClients, bridgeEthContract);

  const wqBridgeController = new BridgeController(
    wqClients,
    configBridge.workQuestNetwork as BlockchainNetworks,
    wqBridgeProvider,
  );
  const bscBridgeController = new BridgeController(
    bscClients,
    configBridge.bscNetwork as BlockchainNetworks,
    bscBridgeProvider,
  );
  const ethBridgeController = new BridgeController(
    ethClients,
    configBridge.ethereumNetwork as BlockchainNetworks,
    ethBridgeProvider,
  );

  const blockInfos = new Map<string, number>();

  for (const network of networks) {
    const [bridgeBlockInfo] = await BridgeParserBlockInfo.findOrCreate({
      where: { network },
      defaults: { network, lastParsedBlock: configBridge[network].parseEventsFromHeight }
    });

    if (bridgeBlockInfo.lastParsedBlock < configBridge[network].parseEventsFromHeight) {
      await bridgeBlockInfo.update({
        lastParsedBlock: configBridge[network].parseEventsFromHeight,
      });
    }

    blockInfos.set(network, bridgeBlockInfo.lastParsedBlock);
  }

  await Promise.all([
    wqBridgeController.collectAllUncollectedEvents(blockInfos.get(configBridge.workQuestNetwork)),
    bscBridgeController.collectAllUncollectedEvents(blockInfos.get(configBridge.bscNetwork)),
    ethBridgeController.collectAllUncollectedEvents(blockInfos.get(configBridge.ethereumNetwork)),
  ]);

  await wqBridgeProvider.startListener();
  bscBridgeProvider.startListener();
  ethBridgeProvider.startListener();
}

init().catch(e => {
  Logger.error(e, 'Worker "Bridge" is stopped with error');
  process.exit(-1);
});
