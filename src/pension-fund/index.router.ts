import Web3 from 'web3';
import configServices from "./config/config.services"
import configPensionFund from "./config/config.pension-fund"
import {SupervisorContractTasks} from "../middleware/middleware.types";
import {PensionRouterController} from "./src/controllers/PensionFundController";
import {BlockchainNetworks, initDatabase} from "@workquest/database-models/lib/models";
import {
  LoggerFactory,
  RouterMQClient,
  ContractSupervisor,
  ContractRouterProvider,
  NotificationMQSenderClient,
} from "../middleware";

import {
  Store,
  Networks,
  WorkQuestNetworkContracts,
} from "@workquest/contract-data-pools";

export async function init() {
  const network = configPensionFund.network() as BlockchainNetworks;

  if (!network) {
    throw new Error('Network argv is undefined. Use arg --network=NetworkName');
  }

  await initDatabase(configServices.database.postgresLink, false, false);

  const contractData = Store[Networks.WorkQuest][WorkQuestNetworkContracts.PensionFund];


}

init().catch((error) => {
  console.log(error)
  process.exit(-1);
});

