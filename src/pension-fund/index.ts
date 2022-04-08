import Web3 from 'web3';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from "./logger/pino";
import { Clients } from "./src/providers/types";
import configDatabase from './config/config.database';
import configPensionFund from './config/config.pensionFund';
import { PensionFundController } from "./src/controllers/pensionFundController";
import { PensionFundBrokerProvider } from "./src/providers/PensionFundBrokerProvider";
import { TransactionBroker } from "../brokers/src/TransactionBroker";
import {
  initDatabase,
  BlockchainNetworks,
  PensionFundBlockInfo,
} from '@workquest/database-models/lib/models';

const abiFilePath = path.join(__dirname, '/abi/WQPensionFund.json');
const abi: any[] = JSON.parse(fs.readFileSync(abiFilePath).toString()).abi;

export async function init() {
  await initDatabase(configDatabase.dbLink, true, false);

  const {
    linkRpcProvider,
    contractAddress,
    parseEventsFromHeight,
  } = configPensionFund.defaultConfigNetwork();

  Logger.debug('Pension Fund starts on "%s" network', configPensionFund.network);
  Logger.debug('WorkQuest network: link Rpc provider "%s"', linkRpcProvider);
  Logger.debug('WorkQuest network contract address: "%s"', contractAddress);

  const rpcProvider = new Web3.providers.HttpProvider(linkRpcProvider);

  const web3 = new Web3(rpcProvider);

  const transactionsBroker = new TransactionBroker(configDatabase.mqLink, 'pension-fund');
  await transactionsBroker.init();

  const clients: Clients = { web3, transactionsBroker };

  const pensionFundContract = new web3.eth.Contract(abi, contractAddress);

  const pensionFundProvider = new PensionFundBrokerProvider(clients, pensionFundContract);
  const pensionFundController = new PensionFundController(clients, configPensionFund.network as BlockchainNetworks, pensionFundProvider);

  const [pensionFundBlockInfo] = await PensionFundBlockInfo.findOrCreate({
    where: { network: BlockchainNetworks.workQuestNetwork },
    defaults: {
      network: BlockchainNetworks.workQuestNetwork,
      lastParsedBlock: parseEventsFromHeight,
    },
  });

  await pensionFundController.collectAllUncollectedEvents(pensionFundBlockInfo.lastParsedBlock);

  await pensionFundProvider.startListener();
}

init().catch(e => {
  Logger.error(e, 'Worker "Pension Fund" is stopped with error');
  process.exit(-1);
});

