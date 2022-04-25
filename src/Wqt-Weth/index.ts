import Web3 from 'web3';
import * as fs from 'fs';
import * as path from 'path';
import configWqtWeth from './config/config.WqtWeth';
import configDatabase from './config/config.database';
import { WqtWethClients } from "./src/providers/types";
import { WqtWethProvider } from './src/providers/WqtWethProvider';
import { NotificationBroker } from "../brokers/src/NotificationBroker";
import { WqtWethController } from './src/controllers/WqtWethController';
import { OraclePricesProvider } from "./src/providers/OraclePricesProvider";
import {
  initDatabase,
  WqtWethBlockInfo,
  BlockchainNetworks,
} from '@workquest/database-models/lib/models';

const abiFilePath = path.join(__dirname, '/abi/WqtWeth.json');
const abi: any[] = JSON.parse(fs.readFileSync(abiFilePath).toString()).abi;

export async function init() {
  await initDatabase(configDatabase.dbLink, false, true);

  const websocketProvider = new Web3.providers.WebsocketProvider(configWqtWeth.wsProvider, {
    reconnect: {
      auto: true,
      delay: 10000,
      onTimeout: false,
    },
  });

  const notificationsBroker = new NotificationBroker(configDatabase.notificationMessageBroker, 'daily_liquidity');
  await notificationsBroker.init();

  const web3 = new Web3(websocketProvider);
  const wqtWethContract = new web3.eth.Contract(abi, configWqtWeth.contractAddress);

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
      lastParsedBlock: configWqtWeth.parseEventsFromHeight,
    },
  });

  await wqtWethController.collectAllUncollectedEvents(wqtWethBlockInfo.lastParsedBlock);

  console.log('Start swap listener');

  await wqtWethProvider.startListener();
}

init().catch(e => {
  console.error(e);
  process.exit(e);
});

