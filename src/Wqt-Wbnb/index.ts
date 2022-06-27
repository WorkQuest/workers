import Web3 from 'web3';
import { WqtWbnbProvider } from './src/providers/WqtWbnbProvider';
import { WqtWbnbController } from './src/controllers/WqtWbnbController';
import { NotificationBroker } from "../brokers/src/NotificationBroker";
import { WqtWbnbClients } from "./src/providers/types";
import configDatabase from './config/config.database';
import configWqtWbnb from './config/config.WqtWbnb';
import { OraclePricesProvider } from "./src/providers/OraclePricesProvider";
import {BnbNetworkContracts, Networks, Store} from "@workquest/contract-data-pools";
import {
  initDatabase,
  WqtWbnbBlockInfo,
  BlockchainNetworks,
} from '@workquest/database-models/lib/models';


export async function init() {
  const contractData = Store[Networks.Bnb][BnbNetworkContracts.WqtWbnb];

  await initDatabase(configDatabase.dbLink, false, true);

  const websocketProvider = new Web3.providers.WebsocketProvider(configWqtWbnb.wsProvider, {
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
  const wqtWbnbProvider = new WqtWbnbProvider(clients, wqtWbnbContract);

  const wqtWbnbController = new WqtWbnbController(
    wqtWbnbProvider,
    new OraclePricesProvider(configWqtWbnb.oracleLink),
    clients,
    BlockchainNetworks.bscMainNetwork
  );

  const [wqtWbnbBlockInfo] = await WqtWbnbBlockInfo.findOrCreate({
    where: { network: BlockchainNetworks.bscMainNetwork },
    defaults: {
      network: BlockchainNetworks.bscMainNetwork,
      lastParsedBlock: contractData.deploymentHeight,
    },
  });

  await wqtWbnbController.collectAllUncollectedEvents(wqtWbnbBlockInfo.lastParsedBlock);

  console.log('Start swap listener');

  await wqtWbnbController.start();
}

init().catch(e => {
  console.error(e);
  process.exit(e);
});

