import Web3 from 'web3';
import {Logger} from "./logger/pino";
import configDatabase from './config/config.database';
import {PensionFundClients} from "./src/providers/types";
import configPensionFund from './config/config.pensionFund';
import {TransactionBroker} from "../brokers/src/TransactionBroker";
import { NotificationBroker} from "../brokers/src/NotificationBroker";
import {PensionFundMQProvider} from "./src/providers/PensionFundProvider";
import {SupervisorContract, SupervisorContractTasks} from "../supervisor";
import {PensionFundListenerController} from "./src/controllers/PensionFundController";
import {initDatabase, BlockchainNetworks} from '@workquest/database-models/lib/models';
import {Networks, Store, WorkQuestNetworkContracts} from "@workquest/contract-data-pools";

export async function init() {
  await initDatabase(configDatabase.dbLink, false, false);

  const contractData = Store[Networks.WorkQuest][WorkQuestNetworkContracts.PensionFund];

  const { linkRpcProvider } = configPensionFund.defaultConfigNetwork();

  Logger.debug('WorkQuest network contract address: "%s"', contractData.address);
  Logger.debug('WorkQuest network: link Rpc provider "%s"', linkRpcProvider);
  Logger.debug('Pension Fund starts on "%s" network', configPensionFund.network);

  const rpcProvider = new Web3.providers.HttpProvider(linkRpcProvider);

  const web3 = new Web3(rpcProvider);

  const transactionsBroker = new TransactionBroker(configDatabase.mqLink, 'pension-fund');
  await transactionsBroker.init();

  const notificationsBroker = new NotificationBroker(configDatabase.notificationMessageBrokerLink, 'pension_fund');
  await notificationsBroker.init();

  const clients: PensionFundClients = { web3, transactionsBroker, notificationsBroker };

  const pensionFundContract = new web3.eth.Contract(contractData.getAbi(), contractData.address);

  const pensionFundProvider = new PensionFundMQProvider(
    contractData.address,
    contractData.deploymentHeight,
    pensionFundContract,
    web3,
    transactionsBroker,
  );

  const pensionFundController = new PensionFundListenerController(
    clients,
    configPensionFund.network as BlockchainNetworks,
    pensionFundProvider,
  );

  await new SupervisorContract(
    Logger,
    pensionFundController,
    pensionFundProvider,
  )
  .setHeightSyncOptions({ period: 300000 })
  .startTasks(SupervisorContractTasks.BlockHeightSync)
}

init().catch(e => {
  Logger.error(e, 'Worker "Pension Fund" is stopped with error');
  process.exit(-1);
});

