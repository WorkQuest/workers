import Web3 from 'web3';
import { Logger } from "./logger/pino";
import configDatabase from './config/config.database';
import { PensionFundClients } from "./src/providers/types";
import configPensionFund from './config/config.pensionFund';
import { PensionFundController } from "./src/controllers/PensionFundController";
import { PensionFundProvider } from "./src/providers/PensionFundProvider";
import { TransactionBroker } from "../brokers/src/TransactionBroker";
import { NotificationBroker } from "../brokers/src/NotificationBroker";
import { Networks, Store, WorkQuestNetworkContracts } from "@workquest/contract-data-pools";
import {
  initDatabase,
  BlockchainNetworks,
  PensionFundBlockInfo,
} from '@workquest/database-models/lib/models';

export async function init() {
  await initDatabase(configDatabase.dbLink, false, false);

  const store = Store[Networks.WorkQuest][WorkQuestNetworkContracts.PensionFund];

  const {
    linkRpcProvider
  } = configPensionFund.defaultConfigNetwork();

  Logger.debug('Pension Fund starts on "%s" network', configPensionFund.network);
  Logger.debug('WorkQuest network: link Rpc provider "%s"', linkRpcProvider);
  Logger.debug('WorkQuest network contract address: "%s"', store.address);

  const rpcProvider = new Web3.providers.HttpProvider(linkRpcProvider);

  const web3 = new Web3(rpcProvider);

  const transactionsBroker = new TransactionBroker(configDatabase.mqLink, 'pension-fund');
  await transactionsBroker.init();

  const notificationsBroker = new NotificationBroker(configDatabase.notificationMessageBrokerLink, 'pension_fund');
  await notificationsBroker.init();

  const clients: PensionFundClients = { web3, transactionsBroker, notificationsBroker };

  const pensionFundContract = new web3.eth.Contract(store.getAbi().abi, store.address);

  const pensionFundProvider = new PensionFundProvider(clients, pensionFundContract);
  const pensionFundController = new PensionFundController(clients, configPensionFund.network as BlockchainNetworks, pensionFundProvider);

  const [pensionFundBlockInfo] = await PensionFundBlockInfo.findOrCreate({
    where: { network: configPensionFund.network },
    defaults: {
      network: configPensionFund.network,
      lastParsedBlock: store.deploymentHeight,
    },
  });

  await pensionFundController.collectAllUncollectedEvents(pensionFundBlockInfo.lastParsedBlock);

  await pensionFundProvider.startListener();
}

init().catch(e => {
  Logger.error(e, 'Worker "Pension Fund" is stopped with error');
  process.exit(-1);
});

