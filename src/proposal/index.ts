import Web3 from 'web3';
import {Logger} from "./logger/pino";
import configProposal from './config/config.proposal';
import configDatabase from './config/config.database';
import {ProposalClients} from "./src/providers/types";
import {TransactionBroker} from "../middleware/src/TransactionBroker";
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

  const rpcProvider = new Web3.providers.HttpProvider(linkRpcProvider);

  const web3 = new Web3(rpcProvider);

  const transactionsBroker = new TransactionBroker(configDatabase.mqLink, 'proposal');
  await transactionsBroker.init();

  const clients: ProposalClients = { web3, transactionsBroker };

  const proposalContract = new web3.eth.Contract(contractData.getAbi(), contractData.address);

  const proposalProvider = new ProposalMQProvider(
    contractData.address,
    contractData.deploymentHeight,
    proposalContract,
    web3,
    transactionsBroker,
  );
  const proposalController = new ProposalListenerController(
    clients,
    configProposal.network as BlockchainNetworks,
    proposalProvider,
  );

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

