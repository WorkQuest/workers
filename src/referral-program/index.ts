import Web3 from 'web3';
import {Logger} from "./logger/pino";
import configDatabase from './config/config.database';
import configReferral from './config/config.referral';
import {ReferralClients} from "./src/providers/types";
import {ReferralProvider} from "./src/providers/ReferralProvider";
import {TransactionBroker} from "../brokers/src/TransactionBroker";
import {NotificationBroker} from "../brokers/src/NotificationBroker";
import {CommunicationBroker} from "../brokers/src/CommunicationBroker";
import {ReferralController} from "./src/controllers/ReferralController";
import {SupervisorContract, SupervisorContractTasks} from "../supervisor";
import {initDatabase, BlockchainNetworks} from '@workquest/database-models/lib/models';
import { Store, Networks, WorkQuestNetworkContracts } from '@workquest/contract-data-pools';

export async function init() {
  await initDatabase(configDatabase.dbLink, true, false);

  const network = configReferral.network as BlockchainNetworks;
  const contractData = Store[Networks.WorkQuest][WorkQuestNetworkContracts.Referral];

  const { linkRpcProvider } = configReferral.defaultConfigNetwork();

  Logger.debug('Referral Program starts on "%s" network', configReferral.network);
  Logger.debug('WorkQuest network: link Rpc provider "%s"', linkRpcProvider);
  Logger.debug('WorkQuest network contract address: "%s"', contractData.address);

  const web3 = new Web3(new Web3.providers.HttpProvider(linkRpcProvider));

  const transactionsBroker = new TransactionBroker(configDatabase.mqLink, 'referral-program');
  await transactionsBroker.init();

  const notificationsBroker = new NotificationBroker(configDatabase.notificationMessageBroker.link, 'referral')
  await notificationsBroker.init();

  const communicationBroker = new CommunicationBroker(configDatabase.mqLink);
  await communicationBroker.init();

  const clients: ReferralClients = { web3, transactionsBroker, notificationsBroker, communicationBroker };

  const referralContract = new web3.eth.Contract(contractData.getAbi(), contractData.address);

  const referralProvider = new ReferralProvider(
    contractData.address,
    contractData.deploymentHeight,
    clients,
    referralContract,
  );

  const referralController = new ReferralController(
    clients,
    network,
    referralProvider,
  );

  await new SupervisorContract(
    Logger,
    referralController,
    referralProvider,
  )
  .startTasks(SupervisorContractTasks.BlockHeightSync)
}

init().catch(e => {
  Logger.error(e, 'Worker "Referral Program" is stopped with error');
  process.exit(-1);
});

