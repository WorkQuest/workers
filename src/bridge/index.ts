import Web3 from "web3";
import { Logger } from "./logger/pino";
import configBridge from "./config/config.bridge";
import configDatabase from "../bridge/config/config.common";
import { BridgeProvider } from "./src/providers/BridgeProvider";
import { BridgeController } from "./src/controllers/BridgeController";
import { BridgeEthClients, BridgeWorkNetClients } from "./src/providers/types";
import { BridgeWorkNetProvider } from "./src/providers/BridgeWorkNetProvider";
import { TransactionBroker } from "../brokers/src/TransactionBroker";
import { NotificationBroker } from "../brokers/src/NotificationBroker";
import { Networks, Store, WorkQuestNetworkContracts, BnbNetworkContracts, EthNetworkContracts } from "@workquest/contract-data-pools";
import {
  initDatabase,
  BlockchainNetworks,
  BridgeParserBlockInfo,
} from "@workquest/database-models/lib/models";

export async function init() {
  await initDatabase(configDatabase.database.link, false, false);

  const contractEthData = Store[Networks.Eth][EthNetworkContracts.WqtBridge];
  const contractBnbData = Store[Networks.Bnb][BnbNetworkContracts.WqtBridge];
  const contractWorkNetData = Store[Networks.WorkQuest][WorkQuestNetworkContracts.WqtBridge];

  const networks = [
    { network: configBridge.bscNetwork, data: contractBnbData },
    { network: configBridge.ethereumNetwork, data: contractEthData },
    { network: configBridge.workQuestNetwork, data: contractWorkNetData }
  ];

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
      delay: 5000, // ms
      maxAttempts: 5,
      onTimeout: false
    },
  });

  const ethWsProvider = new Web3.providers.WebsocketProvider(ethDefaultConfig.linkWsProvider, {
    clientConfig: {
      keepalive: true,
      keepaliveInterval: 60000, // ms
    },
    reconnect: {
      auto: true,
      delay: 5000, // ms
      maxAttempts: 5,
      onTimeout: false
    },
  });

  const web3Wq = new Web3(wqRpcProvider);
  const web3Bsc = new Web3(bscWsProvider);
  const web3Eth = new Web3(ethWsProvider);

  const transactionsBroker = new TransactionBroker(configDatabase.mqLink, 'bridge');
  await transactionsBroker.init();

  const notificationsBroker = new NotificationBroker(configDatabase.notificationMessageBroker.link, 'bridge');
  await notificationsBroker.init();

  const bridgeWqContract = new web3Wq.eth.Contract(contractWorkNetData.getAbi(), contractWorkNetData.address);
  const bridgeBscContract = new web3Bsc.eth.Contract(contractBnbData.getAbi(), contractBnbData.address);
  const bridgeEthContract = new web3Eth.eth.Contract(contractEthData.getAbi(), contractEthData.address);

  Logger.debug('WorkQuest network contract address: "%s"', contractWorkNetData.address);
  Logger.debug('Binance smart chain contract address: "%s"', bscDefaultConfig.contractAddress);
  Logger.debug('Ethereum network contract address: "%s"', ethDefaultConfig.contractAddress);

  const wqClients: BridgeWorkNetClients = { web3: web3Wq, transactionsBroker, notificationsBroker };
  const bscClients: BridgeEthClients = { web3: web3Bsc, webSocketProvider: bscWsProvider, notificationsBroker };
  const ethClients: BridgeEthClients = { web3: web3Eth, webSocketProvider: ethWsProvider, notificationsBroker };

  const wqBridgeProvider = new BridgeWorkNetProvider(wqClients, bridgeWqContract);
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

  for (const { network, data } of networks) {
    const [bridgeBlockInfo] = await BridgeParserBlockInfo.findOrCreate({
      where: { network },
      defaults: { network, lastParsedBlock: data.deploymentHeight }
    });

    if (bridgeBlockInfo.lastParsedBlock < data.deploymentHeight) {
      await bridgeBlockInfo.update({
        lastParsedBlock: data.deploymentHeight,
      });
    }

    blockInfos.set(network, bridgeBlockInfo.lastParsedBlock);
  }

  await Promise.all([
    wqBridgeController.collectAllUncollectedEvents(blockInfos.get(configBridge.workQuestNetwork)),
    bscBridgeController.collectAllUncollectedEvents(blockInfos.get(configBridge.bscNetwork)),
    ethBridgeController.collectAllUncollectedEvents(blockInfos.get(configBridge.ethereumNetwork)),
  ]);

  await Promise.all([
    wqBridgeController.start(),
    bscBridgeController.start(),
    ethBridgeController.start(),
  ]);
}

init().catch(e => {
  Logger.error(e, 'Worker "Bridge" is stopped with error');
  process.exit(-1);
});
