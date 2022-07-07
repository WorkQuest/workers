import Web3 from 'web3';
import {Logger} from "../bridge-usdt/logger/pino";
import {SupervisorContract} from "../supervisor";
import configWqtWbnb from './config/config.WqtWbnb';
import configDatabase from './config/config.database';
import { WqtWbnbClients } from "./src/providers/types";
import { WqtWbnbProvider } from './src/providers/WqtWbnbProvider';
import { NotificationBroker } from "../brokers/src/NotificationBroker";
import { WqtWbnbController } from './src/controllers/WqtWbnbController';
import { OraclePricesProvider } from "./src/providers/OraclePricesProvider";
import {BnbNetworkContracts, Networks, Store} from "@workquest/contract-data-pools";
import {initDatabase, BlockchainNetworks} from '@workquest/database-models/lib/models';

export async function init() {
  const contractData = Store[Networks.Bnb][BnbNetworkContracts.WqtWbnb];

  await initDatabase(configDatabase.dbLink, false, true);

  const websocketProvider = new Web3.providers.WebsocketProvider(configWqtWbnb.wsProvider, {
    clientConfig: {
      keepalive: true,
      keepaliveInterval: 60000
    },
    reconnect: {
      auto: true,
      delay: 10000,
      onTimeout: false,
    },
  });

  const notificationsBroker = new NotificationBroker(configDatabase.notificationMessageBroker, 'daily_liquidity');
  await notificationsBroker.init();

  const web3 = new Web3(websocketProvider);
  const wqtWbnbContract = new web3.eth.Contract(contractData.getAbi(), contractData.address);

  const clients: WqtWbnbClients = { web3, notificationsBroker };

  const wqtWbnbProvider = new WqtWbnbProvider(
    contractData.address,
    contractData.deploymentHeight,
    wqtWbnbContract,
    clients,
  );

  const wqtWbnbController = new WqtWbnbController(
    wqtWbnbProvider,
    new OraclePricesProvider(configWqtWbnb.oracleLink),
    clients,
    BlockchainNetworks.bscMainNetwork
  );

  await new SupervisorContract(
    Logger,
    wqtWbnbController,
    wqtWbnbProvider,
  )
  .startTasks()
}

init().catch(e => {
  console.error(e);
  process.exit(e);
});

