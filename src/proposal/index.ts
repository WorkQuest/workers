import Web3 from 'web3';
import {Logger} from "./logger/pino";
import {TransactionMQListener} from "../middleware";
import configProposal from './config/config.proposal';
import configDatabase from './config/config.database';
import {ProposalMQProvider} from './src/providers/ProposalProvider';
import {SupervisorContract, SupervisorContractTasks} from "../supervisor";
import {ProposalListenerController} from "./src/controllers/ProposalController";
import {initDatabase, BlockchainNetworks} from '@workquest/database-models/lib/models';
import {Networks, Store, WorkQuestNetworkContracts} from "@workquest/contract-data-pools";

export async function init() {
  await initDatabase(configDatabase.dbLink, false, false);

  const { linkRpcProvider } = configProposal.defaultConfigNetwork();
  const contractData = Store[Networks.WorkQuest][WorkQuestNetworkContracts.DAOVoting];

  Logger.debug('Proposal starts on "%s" network', configProposal.network);
  Logger.debug('WorkQuest network: link Rpc provider "%s"', linkRpcProvider);
  Logger.debug('WorkQuest network contract address: "%s"', contractData.address);

  const web3 = new Web3(new Web3.providers.HttpProvider(linkRpcProvider));

  const transactionListener = await new TransactionMQListener(configDatabase.mqLink, 'proposal')
    .on('error', (error) => {
      Logger.error(error, 'Tx listener stopped with error');
      process.exit(-1);
    })
    .init()

  const proposalContract = new web3.eth.Contract(contractData.getAbi(), contractData.address);

  const proposalProvider = new ProposalMQProvider(
    contractData.address,
    contractData.deploymentHeight,
    web3,
    proposalContract,
    transactionListener,
  );
  const proposalController = new ProposalListenerController(
    web3,
    configProposal.network as BlockchainNetworks,
    proposalProvider,
  );

  await transactionListener.init();

  await new SupervisorContract(
    Logger,
    proposalController,
    proposalProvider,
  )
  .setHeightSyncOptions({ period: 300000 })
  .startTasks(SupervisorContractTasks.BlockHeightSync)
}

init().catch(e => {
  Logger.error(e, 'Worker "Proposal" is stopped with error');
  process.exit(-1);
});

