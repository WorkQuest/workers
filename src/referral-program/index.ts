import Web3 from 'web3';
import {Logger} from "./logger/pino";
import configDatabase from './config/config.database';
import configReferral from './config/config.referral';
import {ReferralMQProvider} from "./src/providers/ReferralProvider";
import {ReferralController} from "./src/controllers/ReferralController";
import {SupervisorContract, SupervisorContractTasks} from "../supervisor";
import {initDatabase, BlockchainNetworks} from '@workquest/database-models/lib/models';
import {Store, Networks, WorkQuestNetworkContracts} from '@workquest/contract-data-pools';
import {BridgeMQBetweenWorkers, NotificationMQClient, TransactionMQListener} from "../middleware";

export async function init() {
  await initDatabase(configDatabase.dbLink, true, false);

  const network = configReferral.network as BlockchainNetworks;
  const contractData = Store[Networks.WorkQuest][WorkQuestNetworkContracts.Referral];

  const { linkRpcProvider } = configReferral.defaultConfigNetwork();

  Logger.debug('Referral Program starts on "%s" network', configReferral.network);
  Logger.debug('WorkQuest network: link Rpc provider "%s"', linkRpcProvider);
  Logger.debug('WorkQuest network contract address: "%s"', contractData.address);

  const web3 = new Web3(new Web3.providers.HttpProvider(linkRpcProvider));
  const referralContract = new web3.eth.Contract(contractData.getAbi(), contractData.address);

  const bridgeBetweenWorkers = await new BridgeMQBetweenWorkers(configDatabase.mqLink)
    .on('error', (error) => {
      Logger.error(error, 'Quest cache provider stopped with error');
      process.exit(-1);
    })
    .init()

  const transactionListener = await  new TransactionMQListener(configDatabase.mqLink, 'referral-program')
    .on('error', (error) => {
      Logger.error(error, 'Transaction listener stopped with error');
      process.exit(-1);
    })
    .init()

  const notificationClient = await  new NotificationMQClient(configDatabase.notificationMessageBroker.link, 'referral')
    .on('error', (error) => {
      Logger.error(error, 'Notification client stopped with error');
      process.exit(-1);
    })
    .init()

  const referralProvider = new ReferralMQProvider(
    contractData.address,
    contractData.deploymentHeight,
    web3,
    referralContract,
    Logger.child({
      target: `ReferralMQProvider ("${configReferral.network})"`,
    }),
    transactionListener,
    bridgeBetweenWorkers,
  );

  const referralController = new ReferralController(
    web3,
    Logger.child({
      target: `ReferralController ("${configReferral.network})"`,
    }),
    network,
    referralProvider,
    notificationClient,
  );

  await new SupervisorContract(
    Logger.child({
      target: `SupervisorContract ("${configReferral.network})"`,
    }),
    referralController,
    referralProvider,
  )
  .setHeightSyncOptions({ period: 300000 })
  .startTasks(SupervisorContractTasks.BlockHeightSync)
}

init().catch(e => {
  Logger.error(e, 'Worker "Referral Program" is stopped with error');
  process.exit(-1);
});

