import Web3 from 'web3';
import configServices from "./config/config.services";
import configProposal from "./config/config.proposal";
import {SupervisorContractTasks} from "../middleware/middleware.types"
import {ProposalController} from "./src/controllers/ProposalController";
import {BlockchainNetworks, initDatabase} from "@workquest/database-models/lib/models";
import {
  LoggerFactory,
  ContractSupervisor,
  ContractRpcProvider,
} from "../middleware";
import {
  Store,
  Networks,
  WorkQuestNetworkContracts,
} from "@workquest/contract-data-pools";

async function init() {
  const network = configProposal.network() as BlockchainNetworks;

  if (!network) {
    throw new Error('Network argv is undefined. Use arg --network=NetworkName');
  }

  await initDatabase(configServices.database.postgresLink, false, false);

  const Logger = LoggerFactory.createLogger(`Proposal:${network || ''}`, 'Common');
  const ProposalRpcProviderLogger = LoggerFactory.createLogger(`Proposal:${network || ''}`, 'RpcProvider');
  const ProposalControllerLogger = LoggerFactory.createLogger(`Proposal:${network || ''}`, 'ProposalController');
  const ProposalContractSupervisorLogger = LoggerFactory.createLogger(`Proposal:${network || ''}`, 'ProposalSupervisor');

  const { linkRpcProvider } = configProposal.configForNetwork();
  const web3 = new Web3(new Web3.providers.HttpProvider(linkRpcProvider));

  const contractData = Store[Networks.WorkQuest][WorkQuestNetworkContracts.DAOVoting];
  const contract = new web3.eth.Contract(contractData.getAbi(), contractData.address);

  const proposalProvider = new ContractRpcProvider(
    contractData.address,
    contractData.deploymentHeight,
    web3,
    contract,
    ProposalRpcProviderLogger,
    { stepsRange: 5000 }
  );

  const proposalController = new ProposalController(
    web3,
    ProposalControllerLogger,
    network,
    proposalProvider,
  );

  await new ContractSupervisor(
    ProposalContractSupervisorLogger,
    proposalController,
    { blockHeightSync: { pollPeriod: 4000 } },
    proposalProvider,
  )
    .startTasks(SupervisorContractTasks.BlockHeightSync)
}

init().catch((error) => {
  console.log(error)
  process.exit(-1);
});
