import Web3 from "web3";
import { Logger } from "./logger/pino";
import configBridge from "./config/config.bridge";
import configDatabase from "../bridge/config/config.common";
import { TransactionBroker } from "../brokers/src/TransactionBroker";
import { NotificationBroker } from "../brokers/src/NotificationBroker";
import {SupervisorContract, SupervisorContractTasks} from "../supervisor";
import { BridgeEthClients, BridgeWorkNetClients } from "./src/providers/types";
import { BridgeRpcProvider, BridgeMQProvider } from "./src/providers/BridgeProvider";
import { initDatabase, BlockchainNetworks} from "@workquest/database-models/lib/models";
import {BridgeController, BridgeListenerController} from "./src/controllers/BridgeController";
import {
  Store,
  Networks,
  BnbNetworkContracts,
  EthNetworkContracts,
  WorkQuestNetworkContracts,
} from "@workquest/contract-data-pools";


export async function init() {
  await initDatabase(configDatabase.database.link, false, false);

  const contractEthData = Store[Networks.Eth][EthNetworkContracts.WqtBridge];
  const contractBnbData = Store[Networks.Bnb][BnbNetworkContracts.WqtBridge];
  const contractWorkNetData = Store[Networks.WorkQuest][WorkQuestNetworkContracts.WqtBridge];

  Logger.debug('Binance smart chain network "%s"', configBridge.bscNetwork);
  Logger.debug('Ethereum network "%s"', configBridge.ethereumNetwork);
  Logger.debug('WorkQuest network "%s"', configBridge.workQuestNetwork);

  const wqDefaultConfig = configBridge.defaultWqConfigNetwork();
  const bscDefaultConfig = configBridge.defaultBscConfigNetwork();
  const ethDefaultConfig = configBridge.defaultEthConfigNetwork();

  Logger.debug('WorkQuest network: link Rpc provider "%s"', wqDefaultConfig.linkRpcProvider);

  const wqRpcProvider = new Web3.providers.HttpProvider(wqDefaultConfig.linkRpcProvider);
  const bscRpcProvider = new Web3.providers.HttpProvider(bscDefaultConfig.linkRpcProvider);
  const ethRpcProvider = new Web3.providers.HttpProvider(ethDefaultConfig.linkRpcProvider);

  const web3Wq = new Web3(wqRpcProvider);
  const web3Bsc = new Web3(bscRpcProvider);
  const web3Eth = new Web3(ethRpcProvider);

  const transactionsBroker = new TransactionBroker(configDatabase.mqLink, 'bridge');
  await transactionsBroker.init();

  const notificationsBroker = new NotificationBroker(configDatabase.notificationMessageBroker.link, 'bridge');
  await notificationsBroker.init();

  const bridgeWqContract = new web3Wq.eth.Contract(contractWorkNetData.getAbi(), contractWorkNetData.address);
  const bridgeBscContract = new web3Bsc.eth.Contract(contractBnbData.getAbi(), contractBnbData.address);
  const bridgeEthContract = new web3Eth.eth.Contract(contractEthData.getAbi(), contractEthData.address);

  Logger.debug('WorkQuest network contract address: "%s"', contractWorkNetData.address);
  Logger.debug('Binance smart chain contract address: "%s"', contractBnbData.address);
  Logger.debug('Ethereum network contract address: "%s"', contractEthData.address);

  const wqClients: BridgeWorkNetClients = { web3: web3Wq, transactionsBroker, notificationsBroker };
  const bscClients: BridgeEthClients = { web3: web3Bsc, webSocketProvider: bscRpcProvider, notificationsBroker };
  const ethClients: BridgeEthClients = { web3: web3Eth, webSocketProvider: ethRpcProvider, notificationsBroker };

  const wqBridgeProvider = new BridgeMQProvider(
    contractWorkNetData.address,
    contractWorkNetData.deploymentHeight,
    bridgeWqContract,
    web3Wq,
    transactionsBroker
  );
  const bscBridgeProvider = new BridgeRpcProvider(
    contractBnbData.address,
    contractBnbData.deploymentHeight,
    bridgeBscContract,
    web3Bsc,
  );
  const ethBridgeProvider = new BridgeRpcProvider(
    contractEthData.address,
    contractEthData.deploymentHeight,
    bridgeEthContract,
    web3Eth,
  );

  const wqBridgeController = new BridgeListenerController(
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

  await new SupervisorContract(
    Logger,
    wqBridgeController,
    wqBridgeProvider,
  )
  .setHeightSyncOptions({ period: 300000 })
  .startTasks(SupervisorContractTasks.BlockHeightSync)

  await new SupervisorContract(
    Logger,
    bscBridgeController,
    bscBridgeProvider,
  )
  .setHeightSyncOptions({ period: 10000 })
  .startTasks(SupervisorContractTasks.BlockHeightSync)

  await new SupervisorContract(
    Logger,
    ethBridgeController,
    ethBridgeProvider,
  )
  .setHeightSyncOptions({ period: 10000 })
  .startTasks()
}

init().catch(e => {
  Logger.error(e, 'Worker "Bridge" is stopped with error');
  process.exit(-1);
});
