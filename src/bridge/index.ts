import Web3 from "web3";
import {Logger} from "./logger/pino";
import configBridge from "./config/config.bridge";
import configServices from "./config/config.services";
import {SupervisorContract, SupervisorContractTasks} from "../supervisor";
import {BlockchainNetworks, initDatabase} from "@workquest/database-models/lib/models";
import {BridgeController, BridgeListenerController, BridgeRouterController} from "./src/controllers/BridgeController";
import {
  Store,
  Networks,
  EthNetworkContracts,
  BnbNetworkContracts,
  WorkQuestNetworkContracts,
} from "@workquest/contract-data-pools";
import {
  RouterMQClient,
  ContractWsProvider,
  ContractRpcProvider,
  NotificationMQClient,
  ContractRouterProvider,
} from "../middleware";

const contractEthData = Store[Networks.Eth][EthNetworkContracts.WqtBridge];
const contractBnbData = Store[Networks.Bnb][BnbNetworkContracts.WqtBridge];
const contractWorkNetData = Store[Networks.WorkQuest][WorkQuestNetworkContracts.WqtBridge];

const wqDefaultConfig = configBridge.defaultWqConfigNetwork();
const bscDefaultConfig = configBridge.defaultBscConfigNetwork();
const ethDefaultConfig = configBridge.defaultEthConfigNetwork();

export async function initWithWsConnectionType() {
  await initDatabase(configServices.database.link, false, false);

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

  const notificationClient = await new NotificationMQClient(configServices.messageOriented.notificationMessageBrokerLink, 'bridge')
    .on('error', (error) => {
      Logger.error(error, 'Notification client stopped with error');
      process.exit(-1);
    })
    .init()

  const wqBridgeProvider = new ContractRpcProvider(
    contractWorkNetData.address,
    contractWorkNetData.deploymentHeight,
    web3Wq,
    bridgeWqContract,
    Logger.child({
      target: `BridgeRpcProvider ("${configBridge.workQuestNetwork})"`,
    }),
  );
  const bscBridgeProvider = new ContractWsProvider(
    contractBnbData.address,
    contractBnbData.deploymentHeight,
    web3Bsc,
    bridgeBscContract,
    Logger.child({
      target: `BridgeWsProvider ("${configBridge.bscNetwork})"`,
    }),
  );
  const ethBridgeProvider = new ContractWsProvider(
    contractEthData.address,
    contractEthData.deploymentHeight,
    web3Eth,
    bridgeEthContract,
    Logger.child({
      target: `BridgeWsProvider ("${configBridge.ethereumNetwork})"`,
    }),
  );

  const wqBridgeController = new BridgeController(
    Logger.child({
      target: `BridgeController ("${configBridge.workQuestNetwork})"`,
    }),
    configBridge.workQuestNetwork as BlockchainNetworks,
    wqBridgeProvider,
    notificationClient,
  );
  const bscBridgeController = new BridgeListenerController(
    Logger.child({
      target: `BridgeController ("${configBridge.bscNetwork})"`,
    }),
    configBridge.bscNetwork as BlockchainNetworks,
    bscBridgeProvider,
    notificationClient,
  );
  const ethBridgeController = new BridgeListenerController(
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
  await initDatabase(configServices.database.link, false, false);

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

  const notificationClient = await new NotificationMQClient(configServices.messageOriented.notificationMessageBrokerLink, 'bridge')
    .on('error', (error) => {
      Logger.error(error, 'Notification client stopped with error');
      process.exit(-1);
    })
    .init()

  const wqBridgeProvider = new ContractRpcProvider(
    contractWorkNetData.address,
    contractWorkNetData.deploymentHeight,
    web3Wq,
    bridgeWqContract,
    Logger.child({
      target: `BridgeRpcProvider ("${configBridge.workQuestNetwork})"`,
    }),
  );
  const bscBridgeProvider = new ContractRpcProvider(
    contractBnbData.address,
    contractBnbData.deploymentHeight,
    web3Bsc,
    bridgeBscContract,
    Logger.child({
      target: `BridgeWsProvider ("${configBridge.bscNetwork})"`,
    }),
  );
  const ethBridgeProvider = new ContractRpcProvider(
    contractEthData.address,
    contractEthData.deploymentHeight,
    web3Eth,
    bridgeEthContract,
    Logger.child({
      target: `BridgeWsProvider ("${configBridge.ethereumNetwork})"`,
    }),
  );

  const wqBridgeController = new BridgeController(
    Logger.child({
      target: `BridgeController ("${configBridge.workQuestNetwork})"`,
    }),
    configBridge.workQuestNetwork as BlockchainNetworks,
    wqBridgeProvider,
    notificationClient,
  );
  const bscBridgeController = new BridgeController(
    Logger.child({
      target: `BridgeController ("${configBridge.bscNetwork})"`,
    }),
    configBridge.bscNetwork as BlockchainNetworks,
    bscBridgeProvider,
    notificationClient,
  );
  const ethBridgeController = new BridgeController(
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
  await initDatabase(configServices.database.link, false, false);

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

  const wqBridgeRouterClient = await new RouterMQClient(
    configServices.messageOriented.routerClientMessageBrokerLink,
    'Bridge',
    configBridge.workQuestNetwork as BlockchainNetworks,
  )
    .on('error', error => {
      Logger.error(error, 'RouterClient stopped with error. Network: "%s"', configBridge.workQuestNetwork);
      process.exit(-1);
    })
    .init()
  const bscBridgeRouterClient = await new RouterMQClient(
    configServices.messageOriented.routerClientMessageBrokerLink,
    'Bridge',
    configBridge.bscNetwork as BlockchainNetworks,
  )
    .on('error', error => {
      Logger.error(error, 'RouterClient stopped with error. Network: "%s"', configBridge.workQuestNetwork);
      process.exit(-1);
    })
    .init()
  const ethBridgeRouterClient = await new RouterMQClient(
    configServices.messageOriented.routerClientMessageBrokerLink,
    'Bridge',
    configBridge.ethereumNetwork as BlockchainNetworks,
  )
    .on('error', error => {
      Logger.error(error, 'RouterClient stopped with error. Network: "%s"', configBridge.workQuestNetwork);
      process.exit(-1);
    })
    .init()

  // const notificationClient = await new NotificationMQClient(configServices.messageOriented.notificationMessageBrokerLink, 'bridge')
  //   .on('error', error => {
  //     Logger.error(error, 'Notification client stopped with error');
  //     process.exit(-1);
  //   })
  //   .init()

  const wqBridgeProvider = new ContractRouterProvider(
    contractWorkNetData.address,
    contractWorkNetData.deploymentHeight,
    bridgeWqContract,
    contractWorkNetData.getAbi(),
    Logger.child({
      target: `BridgeRpcProvider ("${configBridge.workQuestNetwork})"`,
    }),
    wqBridgeRouterClient,
  );
  const bscBridgeProvider = new ContractRouterProvider(
    contractBnbData.address,
    contractBnbData.deploymentHeight,
    bridgeBscContract,
    contractBnbData.getAbi(),
    Logger.child({
      target: `BridgeWsProvider ("${configBridge.bscNetwork})"`,
    }),
    bscBridgeRouterClient,
  );
  const ethBridgeProvider = new ContractRouterProvider(
    contractEthData.address,
    contractEthData.deploymentHeight,
    bridgeEthContract,
    contractEthData.getAbi(),
    Logger.child({
      target: `BridgeWsProvider ("${configBridge.ethereumNetwork})"`,
    }),
    ethBridgeRouterClient,
  );

  const wqBridgeController = new BridgeRouterController(
    Logger.child({
      target: `BridgeController ("${configBridge.workQuestNetwork})"`,
    }),
    configBridge.workQuestNetwork as BlockchainNetworks,
    wqBridgeProvider,
    null,
    // notificationClient,
  );
  const bscBridgeController = new BridgeRouterController(
    Logger.child({
      target: `BridgeController ("${configBridge.bscNetwork})"`,
    }),
    configBridge.bscNetwork as BlockchainNetworks,
    bscBridgeProvider,
    null,
    // notificationClient,
  );
  const ethBridgeController = new BridgeRouterController(
    Logger.child({
      target: `BridgeController ("${configBridge.ethereumNetwork})"`,
    }),
    configBridge.ethereumNetwork as BlockchainNetworks,
    ethBridgeProvider,
    null,
    // notificationClient,
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

