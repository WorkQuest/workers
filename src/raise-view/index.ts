import Web3 from 'web3';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from "./logger/pino";
import configDatabase from "./config/configDatabase";
import configRaiseView from "./config/config.raiseView";
import { RaiseViewClients } from "./src/providers/types";
import { TransactionBroker } from "../brokers/src/TransactionBroker";
import { RaiseViewProvider } from "./src/providers/RaiseViewProvider";
import { RaiseViewController } from "./src/controllers/RaiseViewController";
import {
  initDatabase,
  BlockchainNetworks,
  RaiseViewBlockInfo,
} from '@workquest/database-models/lib/models';

const abiFilePath = path.join(__dirname, '../../src/raise-view/abi/WQPromotion.json');
const abi: any[] = JSON.parse(fs.readFileSync(abiFilePath).toString()).abi;

export async function init() {
  Logger.info('Start worker "Raise view". Network: "%s"', configRaiseView.network);

  await initDatabase(configDatabase.dbLink, false, true);

  const { linkRpcProvider, contractAddress, parseEventsFromHeight } = configRaiseView.defaultConfigNetwork();

  Logger.info('Listening on contract address: "%s"', contractAddress);
  Logger.debug('Link Rpc provider: "%s"', linkRpcProvider);

  const web3 = new Web3(new Web3.providers.HttpProvider(linkRpcProvider));
  const raiseViewContract = new web3.eth.Contract(abi, contractAddress);

  const transactionsBroker = new TransactionBroker(configDatabase.mqLink, 'raise-view');
  await transactionsBroker.init();

  const clients: RaiseViewClients = { web3, transactionsBroker };

  const [raiseViewBlockInfo] = await RaiseViewBlockInfo.findOrCreate({
    where: { network: BlockchainNetworks.workQuestDevNetwork },
    defaults: {
      network: BlockchainNetworks.workQuestDevNetwork,
      lastParsedBlock: parseEventsFromHeight,
    },
  });

  if (raiseViewBlockInfo.lastParsedBlock < parseEventsFromHeight) {
    raiseViewBlockInfo.lastParsedBlock = parseEventsFromHeight;

    await raiseViewBlockInfo.save();
  }

  const raiseViewProvider = new RaiseViewProvider(clients, raiseViewContract);
  const raiseViewController = new RaiseViewController(clients, raiseViewProvider, configRaiseView.network as BlockchainNetworks);

  await raiseViewController.collectAllUncollectedEvents(raiseViewBlockInfo.lastParsedBlock);

  await raiseViewProvider.startListener();
}

init().catch(e => {
  Logger.error(e, 'Worker "Raise view" is stopped with error');
  process.exit(-1);
});
