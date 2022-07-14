import Web3 from "web3";
import {Logger} from "./logger/pino";
import configBridge from "./config/config.bridge";
import configDatabase from "../bridge/config/config.common";
import {SupervisorContract, SupervisorContractTasks} from "../supervisor";
import {TransactionMQListener, NotificationMQClient} from "../middleware";
import {BridgeProvider, BridgeMQProvider} from "./src/providers/BridgeProvider";
import {initDatabase, BlockchainNetworks} from "@workquest/database-models/lib/models";
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

  const transactionListener = new TransactionMQListener(configDatabase.mqLink, 'bridge');
  const notificationClient = new NotificationMQClient(configDatabase.notificationMessageBroker.link, 'bridge');

  const bridgeWqContract = new web3Wq.eth.Contract(contractWorkNetData.getAbi(), contractWorkNetData.address);
  const bridgeBscContract = new web3Bsc.eth.Contract(contractBnbData.getAbi(), contractBnbData.address);
  const bridgeEthContract = new web3Eth.eth.Contract(contractEthData.getAbi(), contractEthData.address);

  Logger.debug('WorkQuest network contract address: "%s"', contractWorkNetData.address);
  Logger.debug('Binance smart chain contract address: "%s"', contractBnbData.contractAddress);
  Logger.debug('Ethereum network contract address: "%s"', contractEthData.contractAddress);

  const wqBridgeProvider = new BridgeMQProvider(
    contractWorkNetData.address,
    contractWorkNetData.deploymentHeight,
    web3Wq,
    bridgeWqContract,
    transactionListener,
  );
  const bscBridgeProvider = new BridgeProvider(
    contractBnbData.address,
    contractBnbData.deploymentHeight,
    web3Bsc,
    bridgeBscContract,
  );
  const ethBridgeProvider = new BridgeProvider(
    contractEthData.address,
    contractEthData.deploymentHeight,
    web3Eth,
    bridgeEthContract,
  );

  const wqBridgeController = new BridgeListenerController(
    web3Wq,
    configBridge.workQuestNetwork as BlockchainNetworks,
    wqBridgeProvider,
    notificationClient,
  );
  const bscBridgeController = new BridgeController(
    web3Bsc,
    configBridge.bscNetwork as BlockchainNetworks,
    bscBridgeProvider,
    notificationClient,
  );
  const ethBridgeController = new BridgeController(
    web3Eth,
    configBridge.ethereumNetwork as BlockchainNetworks,
    ethBridgeProvider,
    notificationClient,
  );

  await notificationClient.init();
  await transactionListener.init();

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
