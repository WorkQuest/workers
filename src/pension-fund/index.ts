import Web3 from 'web3';
import {Logger} from "./logger/pino";
import configDatabase from './config/config.database';
import configPensionFund from './config/config.pensionFund';
import {NotificationMQClient, TransactionMQListener} from "../middleware";
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

  const web3 = new Web3(new Web3.providers.HttpProvider(linkRpcProvider));

  const transactionListener = new TransactionMQListener(configDatabase.mqLink, 'pension-fund');
  const notificationClient = new NotificationMQClient(configDatabase.notificationMessageBrokerLink, 'pension_fund');

  const pensionFundContract = new web3.eth.Contract(contractData.getAbi(), contractData.address);

  const pensionFundProvider = new PensionFundMQProvider(
    contractData.address,
    contractData.deploymentHeight,
    pensionFundContract,
    web3,
    transactionListener,
  );

  const pensionFundController = new PensionFundListenerController(
    web3,
    configPensionFund.network as BlockchainNetworks,
    notificationClient,
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

