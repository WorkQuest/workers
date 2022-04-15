import Web3 from 'web3';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from "./logger/pino";
import configSavings from "./config/config.savings";
import configDatabase from './config/config.database';
import { SavingProductClients } from "./src/providers/types";
import { TransactionBroker } from "../brokers/src/TransactionBroker";
import { SavingProductProvider } from "./src/providers/SavingProductProvider";
import { SavingProductController } from "./src/controllers/SavingProductController";
import {
  initDatabase,
  BlockchainNetworks,
  SavingProductParseBlock
} from '@workquest/database-models/lib/models';

const abiFilePath = path.join(__dirname, '/abi/WQSavingProduct.json');
const abi: any[] = JSON.parse(fs.readFileSync(abiFilePath).toString()).abi;

export async function init() {
  await initDatabase(configDatabase.dbLink, true, false);

  const network = configSavings.network as BlockchainNetworks;

  const {
    linkRpcProvider,
    contractAddress,
    parseEventsFromHeight,
  } = configSavings.defaultConfigNetwork();

  Logger.debug('Saving Product starts on "%s" network', configSavings.network);
  Logger.debug('WorkQuest network: link Rpc provider "%s"', linkRpcProvider);
  Logger.debug('WorkQuest network contract address: "%s"', contractAddress);

  const rpcProvider = new Web3.providers.HttpProvider(linkRpcProvider);

  const web3 = new Web3(rpcProvider);

  const transactionsBroker = new TransactionBroker(configDatabase.mqLink, 'saving-product');
  await transactionsBroker.init();

  const clients: SavingProductClients = { web3, transactionsBroker };

  const savingProductContract = new web3.eth.Contract(abi, contractAddress);

  const savingProductProvider = new SavingProductProvider(clients, savingProductContract);
  const savingProductController = new SavingProductController(clients, network, savingProductProvider);

  const [savingProductBlockInfo] = await SavingProductParseBlock.findOrCreate({
    where: { network },
    defaults: { network, lastParsedBlock: parseEventsFromHeight },
  });

  await savingProductController.collectAllUncollectedEvents(savingProductBlockInfo.lastParsedBlock);

  await savingProductProvider.startListener();
}

init().catch(e => {
  Logger.error(e, 'Worker "Saving Product" is stopped with error');
  process.exit(-1);
});

