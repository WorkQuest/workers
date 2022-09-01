import Web3 from 'web3';
import configServices from "./config/config.services";
import configPensionFund from "./config/config.pension-fund";
import {SupervisorContractTasks} from "../middleware/middleware.types"
import {PensionFundController} from "./src/controllers/PensionFundController";
import {BlockchainNetworks, initDatabase} from "@workquest/database-models/lib/models";
import {
  LoggerFactory,
  ContractSupervisor,
  ContractRpcProvider,
  NotificationMQSenderClient,
} from "../middleware";
import {
  Store,
  Networks,
  WorkQuestNetworkContracts,
} from "@workquest/contract-data-pools";

async function init() {
  const network = configPensionFund.network() as BlockchainNetworks;

  if (!network) {
    throw new Error('Network argv is undefined. Use arg --network=NetworkName');
  }

  await initDatabase(configServices.database.postgresLink, false, false);

  const Logger = LoggerFactory.createLogger(`PensionFund:${network || ''}`, 'Common');
  const PensionFundRpcProviderLogger = LoggerFactory.createLogger(`PensionFund:${network || ''}`, 'RpcProvider');
  const PensionFundControllerLogger = LoggerFactory.createLogger(`PensionFund:${network || ''}`, 'PensionFundController');
  const PensionFundContractSupervisorLogger = LoggerFactory.createLogger(`PensionFund:${network || ''}`, 'PensionFundSupervisor');

  const { linkRpcProvider } = configPensionFund.configForNetwork();
  const web3 = new Web3(new Web3.providers.HttpProvider(linkRpcProvider));

  const contractData = Store[Networks.WorkQuest][WorkQuestNetworkContracts.PensionFund];
  const contract = new web3.eth.Contract(contractData.getAbi(), contractData.address);

  const notificationSenderClient = await new NotificationMQSenderClient(configServices.messageOriented.notificationMessageBrokerLink, 'pension_fund')
    .on('error', error => {
      Logger.error(error, 'Notification client stopped with error');
      process.exit(-1);
    })
    .init()

  const pensionFundProvider = new ContractRpcProvider(
    contractData.address,
    contractData.deploymentHeight,
    web3,
    contract,
    PensionFundRpcProviderLogger,
    { stepsRange: 5000 }
  );

  const pensionFundController = new PensionFundController(
    web3,
    PensionFundControllerLogger,
    network,
    pensionFundProvider,
    notificationSenderClient,
  );

  await new ContractSupervisor(
    PensionFundContractSupervisorLogger,
    pensionFundController,
    { blockHeightSync: { pollPeriod: 4000 } },
    pensionFundProvider,
  )
    .startTasks(SupervisorContractTasks.BlockHeightSync)
}

init().catch((error) => {
  console.log(error)
  process.exit(-1);
});
