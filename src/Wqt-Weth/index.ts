import Web3 from 'web3';
import configWqtWeth from './config/config.WqtWeth';
import configDatabase from './config/config.database';
import { WqtWethClients } from "./src/providers/types";
import { WqtWethProvider } from './src/providers/WqtWethProvider';
import { NotificationBroker } from "../brokers/src/NotificationBroker";
import { WqtWethController } from './src/controllers/WqtWethController';
import { OraclePricesProvider } from "./src/providers/OraclePricesProvider";
import {EthNetworkContracts, Networks, Store} from "@workquest/contract-data-pools";
import {
  initDatabase,
  WqtWethBlockInfo,
  BlockchainNetworks,
} from '@workquest/database-models/lib/models';

export async function init() {
  const contractData = Store[Networks.Eth][EthNetworkContracts.WqtWeth];

  await initDatabase(configDatabase.dbLink, false, true);

  const websocketProvider = new Web3.providers.WebsocketProvider(configWqtWeth.wsProvider, {
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
  const wqtWethContract = new web3.eth.Contract(contractData.getAbi(), contractData.address);

  const clients: WqtWethClients = { web3, notificationsBroker };
  const wqtWethProvider = new WqtWethProvider(clients, wqtWethContract);

  const wqtWethController = new WqtWethController(
    wqtWethProvider,
    new OraclePricesProvider(configWqtWeth.oracleLink),
    clients,
    BlockchainNetworks.ethMainNetwork,
  );

  const [wqtWethBlockInfo] = await WqtWethBlockInfo.findOrCreate({
    where: { network: BlockchainNetworks.ethMainNetwork },
    defaults: {
      network: BlockchainNetworks.ethMainNetwork,
      lastParsedBlock: contractData.deploymentHeight,
    },
  });

  await wqtWethController.collectAllUncollectedEvents(wqtWethBlockInfo.lastParsedBlock);

  console.log('Start swap listener');

  await wqtWethController.start();
}

init().catch(e => {
  console.error(e);
  process.exit(e);
});

