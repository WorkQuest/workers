import Web3 from 'web3';
import configServices from "./config/config.services";
import configProposal from "./config/config.proposal";
import {SupervisorContractTasks} from "../middleware/middleware.types";
import {ProposalRouterController} from "./src/controllers/ProposalController";
import {BlockchainNetworks, initDatabase} from "@workquest/database-models/lib/models";
import {
  LoggerFactory,
  RouterMQClient,
  ContractSupervisor,
  ContractRouterProvider,
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
  const ProposalRouterProviderLogger = LoggerFactory.createLogger(`Proposal:${network || ''}`, 'RouterProvider');
  const ProposalControllerLogger = LoggerFactory.createLogger(`Proposal:${network || ''}`, 'ProposalController');
  const ProposalContractSupervisorLogger = LoggerFactory.createLogger(`Proposal:${network || ''}`, 'ProposalSupervisor');

  const { linkRpcProvider } = configProposal.configForNetwork();
  const contractData = Store[Networks.WorkQuest][WorkQuestNetworkContracts.DAOVoting];

  const web3 = new Web3(new Web3.providers.HttpProvider(linkRpcProvider));

  const proposalRouterClient = await new RouterMQClient(
    configServices.messageOriented.routerClientMessageBrokerLink,
    'Proposal',
    network,
  )
    .on('error', error => {
      Logger.error(error, 'RouterClient stopped with error.');
      process.exit(-1);
    })
    .init()

  const proposalProvider = new ContractRouterProvider(
    contractData.address,
    contractData.deploymentHeight,
    contractData.getAbi(),
    ProposalRouterProviderLogger,
    proposalRouterClient,
  )
    .startListener()

  const proposalController = new ProposalRouterController(
    web3,
    ProposalControllerLogger,
    network,
    proposalProvider,
  );

  await new ContractSupervisor(
    ProposalContractSupervisorLogger,
    proposalController,
    { blockHeightSync: { pollPeriod: 25000 } },
    proposalProvider,
  )
    .startTasks(SupervisorContractTasks.BlockHeightSync)
}

init().catch((error) => {
  console.log(error)
  process.exit(-1);
});
