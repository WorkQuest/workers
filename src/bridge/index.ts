import Web3 from "web3";
import {Logger} from "./logger/pino";
import configBridge from "./config/config.bridge";
import {NotificationMQClient} from "../middleware";
import configDatabase from "../bridge/config/config.common";
import {SupervisorContract, SupervisorContractTasks} from "../supervisor";
import {initDatabase, BlockchainNetworks} from "@workquest/database-models/lib/models";
import {BridgeRpcProvider, BridgeRouterProvider, BridgeWsProvider} from "./src/providers/BridgeProviders";
import {BridgeController, BridgeListenerController, BridgeRouterController} from "./src/controllers/BridgeController";
import {
  Store,
  Networks,
  BnbNetworkContracts,
  EthNetworkContracts,
  WorkQuestNetworkContracts,
} from "@workquest/contract-data-pools";

const contractEthData = Store[Networks.Eth][EthNetworkContracts.WqtBridge];
const contractBnbData = Store[Networks.Bnb][BnbNetworkContracts.WqtBridge];
const contractWorkNetData = Store[Networks.WorkQuest][WorkQuestNetworkContracts.WqtBridge];

const wqDefaultConfig = configBridge.defaultWqConfigNetwork();
const bscDefaultConfig = configBridge.defaultBscConfigNetwork();
const ethDefaultConfig = configBridge.defaultEthConfigNetwork();


export async function initWithWsConnectionType() {
  await initDatabase(configDatabase.database.link, false, false);

  Logger.debug('Ethereum network "%s"', configBridge.ethereumNetwork);
  Logger.debug('WorkQuest network "%s"', configBridge.workQuestNetwork);
  Logger.debug('Binance smart chain network "%s"', configBridge.bscNetwork);

  /** Ws not working on Ethermint */
  const wqRpcProvider = new Web3.providers.HttpProvider(wqDefaultConfig.linkRpcProvider);
  const ethWsProvider = new Web3.providers.WebsocketProvider(ethDefaultConfig.linkWsProvider);
  const bscWsProvider = new Web3.providers.WebsocketProvider(bscDefaultConfig.linkWsProvider);

  const web3Wq = new Web3(wqRpcProvider);
  const web3Bsc = new Web3(bscWsProvider);
  const web3Eth = new Web3(ethWsProvider);

  const bridgeBscContract = new web3Bsc.eth.Contract(contractBnbData.getAbi(), contractBnbData.address);
  const bridgeEthContract = new web3Eth.eth.Contract(contractEthData.getAbi(), contractEthData.address);
  const bridgeWqContract = new web3Wq.eth.Contract(contractWorkNetData.getAbi(), contractWorkNetData.address);

  const notificationClient = await new NotificationMQClient(configDatabase.notificationMessageBroker.link, 'bridge')
    .on('error', (error) => {
      Logger.error(error, 'Notification client stopped with error');
      process.exit(-1);
    })
    .init()

  const wqBridgeProvider = new BridgeRpcProvider(
    contractWorkNetData.address,
    contractWorkNetData.deploymentHeight,
    web3Wq,
    bridgeWqContract,
    Logger.child({
      target: `BridgeRpcProvider ("${configBridge.workQuestNetwork})"`,
    }),
  );
  const bscBridgeProvider = new BridgeWsProvider(
    contractBnbData.address,
    contractBnbData.deploymentHeight,
    web3Bsc,
    bridgeBscContract,
    Logger.child({
      target: `BridgeWsProvider ("${configBridge.bscNetwork})"`,
    }),
  );
  const ethBridgeProvider = new BridgeWsProvider(
    contractEthData.address,
    contractEthData.deploymentHeight,
    web3Eth,
    bridgeEthContract,
    Logger.child({
      target: `BridgeWsProvider ("${configBridge.ethereumNetwork})"`,
    }),
  );

  const wqBridgeController = new BridgeController(
    web3Wq,
    Logger.child({
      target: `BridgeController ("${configBridge.workQuestNetwork})"`,
    }),
    configBridge.workQuestNetwork as BlockchainNetworks,
    wqBridgeProvider,
    notificationClient,
  );
  const bscBridgeController = new BridgeListenerController(
    web3Bsc,
    Logger.child({
      target: `BridgeController ("${configBridge.bscNetwork})"`,
    }),
    configBridge.bscNetwork as BlockchainNetworks,
    bscBridgeProvider,
    notificationClient,
  );
  const ethBridgeController = new BridgeListenerController(
    web3Eth,
    Logger.child({
      target: `BridgeController ("${configBridge.ethereumNetwork})"`,
    }),
    configBridge.ethereumNetwork as BlockchainNetworks,
    ethBridgeProvider,
    notificationClient,
  );

  await new SupervisorContract(
    Logger.child({
      target: `SupervisorContract ("${configBridge.workQuestNetwork})"`,
    }),
    wqBridgeController,
    wqBridgeProvider,
  )
    .setHeightSyncOptions({ period: 300000 })
    .startTasks(SupervisorContractTasks.BlockHeightSync)

  await new SupervisorContract(
    Logger.child({
      target: `SupervisorContract ("${configBridge.bscNetwork})"`,
    }),
    bscBridgeController,
    bscBridgeProvider,
  )
    .setHeightSyncOptions({ period: 300000 })
    .startTasks(SupervisorContractTasks.BlockHeightSync)

  await new SupervisorContract(
    Logger.child({
      target: `SupervisorContract ("${configBridge.ethereumNetwork})"`,
    }),
    ethBridgeController,
    ethBridgeProvider,
  )
    .setHeightSyncOptions({ period: 300000 })
    .startTasks(SupervisorContractTasks.BlockHeightSync)
}

export async function initWithRpcConnectionType() {
  await initDatabase(configDatabase.database.link, false, false);

  Logger.debug('Ethereum network "%s"', configBridge.ethereumNetwork);
  Logger.debug('WorkQuest network "%s"', configBridge.workQuestNetwork);
  Logger.debug('Binance smart chain network "%s"', configBridge.bscNetwork);

  const wqRpcProvider = new Web3.providers.HttpProvider(wqDefaultConfig.linkRpcProvider);
  const ethRpcProvider = new Web3.providers.HttpProvider(ethDefaultConfig.linkRpcProvider);
  const bscRpcProvider = new Web3.providers.HttpProvider(bscDefaultConfig.linkRpcProvider);

  const web3Wq = new Web3(wqRpcProvider);
  const web3Bsc = new Web3(bscRpcProvider);
  const web3Eth = new Web3(ethRpcProvider);

  const bridgeBscContract = new web3Bsc.eth.Contract(contractBnbData.getAbi(), contractBnbData.address);
  const bridgeEthContract = new web3Eth.eth.Contract(contractEthData.getAbi(), contractEthData.address);
  const bridgeWqContract = new web3Wq.eth.Contract(contractWorkNetData.getAbi(), contractWorkNetData.address);

  const notificationClient = await new NotificationMQClient(configDatabase.notificationMessageBroker.link, 'bridge')
    .on('error', (error) => {
      Logger.error(error, 'Notification client stopped with error');
      process.exit(-1);
    })
    .init()

  const wqBridgeProvider = new BridgeRpcProvider(
    contractWorkNetData.address,
    contractWorkNetData.deploymentHeight,
    web3Wq,
    bridgeWqContract,
    Logger.child({
      target: `BridgeRpcProvider ("${configBridge.workQuestNetwork})"`,
    }),
  );
  const bscBridgeProvider = new BridgeRpcProvider(
    contractBnbData.address,
    contractBnbData.deploymentHeight,
    web3Bsc,
    bridgeBscContract,
    Logger.child({
      target: `BridgeWsProvider ("${configBridge.bscNetwork})"`,
    }),
  );
  const ethBridgeProvider = new BridgeRpcProvider(
    contractEthData.address,
    contractEthData.deploymentHeight,
    web3Eth,
    bridgeEthContract,
    Logger.child({
      target: `BridgeWsProvider ("${configBridge.ethereumNetwork})"`,
    }),
  );

  const wqBridgeController = new BridgeController(
    web3Wq,
    Logger.child({
      target: `BridgeController ("${configBridge.workQuestNetwork})"`,
    }),
    configBridge.workQuestNetwork as BlockchainNetworks,
    wqBridgeProvider,
    notificationClient,
  );
  const bscBridgeController = new BridgeController(
    web3Bsc,
    Logger.child({
      target: `BridgeController ("${configBridge.bscNetwork})"`,
    }),
    configBridge.bscNetwork as BlockchainNetworks,
    bscBridgeProvider,
    notificationClient,
  );
  const ethBridgeController = new BridgeController(
    web3Eth,
    Logger.child({
      target: `BridgeController ("${configBridge.ethereumNetwork})"`,
    }),
    configBridge.ethereumNetwork as BlockchainNetworks,
    ethBridgeProvider,
    notificationClient,
  );

  await new SupervisorContract(
    Logger.child({
      target: `SupervisorContract ("${configBridge.workQuestNetwork})"`,
    }),
    wqBridgeController,
    wqBridgeProvider,
  )
    .setHeightSyncOptions({ period: 30000 })
    .startTasks(SupervisorContractTasks.BlockHeightSync)

  await new SupervisorContract(
    Logger.child({
      target: `SupervisorContract ("${configBridge.bscNetwork})"`,
    }),
    bscBridgeController,
    bscBridgeProvider,
  )
    .setHeightSyncOptions({ period: 30000 })
    .startTasks(SupervisorContractTasks.BlockHeightSync)

  await new SupervisorContract(
    Logger.child({
      target: `SupervisorContract ("${configBridge.ethereumNetwork})"`,
    }),
    ethBridgeController,
    ethBridgeProvider,
  )
    .setHeightSyncOptions({ period: 30000 })
    .startTasks(SupervisorContractTasks.BlockHeightSync)
}

export async function initWithRoutingConnectionType() {
  await initDatabase(configDatabase.database.link, false, false);

  Logger.debug('Ethereum network "%s"', configBridge.ethereumNetwork);
  Logger.debug('WorkQuest network "%s"', configBridge.workQuestNetwork);
  Logger.debug('Binance smart chain network "%s"', configBridge.bscNetwork);

  const wqRpcProvider = new Web3.providers.HttpProvider(wqDefaultConfig.linkRpcProvider);
  const ethRpcProvider = new Web3.providers.HttpProvider(ethDefaultConfig.linkRpcProvider);
  const bscRpcProvider = new Web3.providers.HttpProvider(bscDefaultConfig.linkRpcProvider);

  const web3Wq = new Web3(wqRpcProvider);
  const web3Bsc = new Web3(bscRpcProvider);
  const web3Eth = new Web3(ethRpcProvider);

  const bridgeBscContract = new web3Bsc.eth.Contract(contractBnbData.getAbi(), contractBnbData.address);
  const bridgeEthContract = new web3Eth.eth.Contract(contractEthData.getAbi(), contractEthData.address);
  const bridgeWqContract = new web3Wq.eth.Contract(contractWorkNetData.getAbi(), contractWorkNetData.address);

  const notificationClient = await new NotificationMQClient(configDatabase.notificationMessageBroker.link, 'bridge')
    .on('error', (error) => {
      Logger.error(error, 'Notification client stopped with error');
      process.exit(-1);
    })
    .init()

  const wqBridgeProvider = new BridgeRouterProvider(
    contractWorkNetData.address,
    contractWorkNetData.deploymentHeight,
    web3Wq,
    bridgeWqContract,
    contractWorkNetData.getAbi(),
    Logger.child({
      target: `BridgeRpcProvider ("${configBridge.workQuestNetwork})"`,
    }),
    null,
  );
  const bscBridgeProvider = new BridgeRouterProvider(
    contractBnbData.address,
    contractBnbData.deploymentHeight,
    web3Bsc,
    bridgeBscContract,
    contractBnbData.getAbi(),
    Logger.child({
      target: `BridgeWsProvider ("${configBridge.bscNetwork})"`,
    }),
    null,
  );
  const ethBridgeProvider = new BridgeRouterProvider(
    contractEthData.address,
    contractEthData.deploymentHeight,
    web3Eth,
    bridgeEthContract,
    contractEthData.getAbi(),
    Logger.child({
      target: `BridgeWsProvider ("${configBridge.ethereumNetwork})"`,
    }),
    null,
  );

  const wqBridgeController = new BridgeRouterController(
    web3Wq,
    Logger.child({
      target: `BridgeController ("${configBridge.workQuestNetwork})"`,
    }),
    configBridge.workQuestNetwork as BlockchainNetworks,
    wqBridgeProvider,
    notificationClient,
  );
  const bscBridgeController = new BridgeRouterController(
    web3Bsc,
    Logger.child({
      target: `BridgeController ("${configBridge.bscNetwork})"`,
    }),
    configBridge.bscNetwork as BlockchainNetworks,
    bscBridgeProvider,
    notificationClient,
  );
  const ethBridgeController = new BridgeRouterController(
    web3Eth,
    Logger.child({
      target: `BridgeController ("${configBridge.ethereumNetwork})"`,
    }),
    configBridge.ethereumNetwork as BlockchainNetworks,
    ethBridgeProvider,
    notificationClient,
  );

  await new SupervisorContract(
    Logger.child({
      target: `SupervisorContract ("${configBridge.workQuestNetwork})"`,
    }),
    wqBridgeController,
    wqBridgeProvider,
  )
    .setHeightSyncOptions({ period: 300000 })
    .startTasks(SupervisorContractTasks.BlockHeightSync)

  await new SupervisorContract(
    Logger.child({
      target: `SupervisorContract ("${configBridge.bscNetwork})"`,
    }),
    bscBridgeController,
    bscBridgeProvider,
  )
    .setHeightSyncOptions({ period: 300000 })
    .startTasks(SupervisorContractTasks.BlockHeightSync)

  await new SupervisorContract(
    Logger.child({
      target: `SupervisorContract ("${configBridge.ethereumNetwork})"`,
    }),
    ethBridgeController,
    ethBridgeProvider,
  )
    .setHeightSyncOptions({ period: 300000 })
    .startTasks(SupervisorContractTasks.BlockHeightSync)
}

if (configBridge.connectionType === 'ws') {
  initWithWsConnectionType().catch(e => {
    Logger.error(e, 'Worker "Bridge" is stopped with error');
    process.exit(-1);
  });
}
if (configBridge.connectionType === 'rpc') {
  initWithRpcConnectionType().catch(e => {
    Logger.error(e, 'Worker "Bridge" is stopped with error');
    process.exit(-1);
  });
}
if (configBridge.connectionType === 'routing') {
  initWithRoutingConnectionType().catch(e => {
    Logger.error(e, 'Worker "Bridge" is stopped with error');
    process.exit(-1);
  });
}

