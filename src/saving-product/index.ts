import Web3 from 'web3';
import {Logger} from "./logger/pino";
import configSavings from "./config/config.savings";
import configDatabase from './config/config.database';
import {SavingProductClients} from "./src/providers/types";
import {TransactionBroker} from "../brokers/src/TransactionBroker";
import {SupervisorContract, SupervisorContractTasks} from "../supervisor";
import {SavingProductProvider} from "./src/providers/SavingProductProvider";
import {SavingProductController} from "./src/controllers/SavingProductController";
import {Networks, Store, WorkQuestNetworkContracts} from "@workquest/contract-data-pools";
import {initDatabase, BlockchainNetworks} from '@workquest/database-models/lib/models';

export async function init() {
  await initDatabase(configDatabase.dbLink, false, true);

  const contractData = Store[Networks.WorkQuest][WorkQuestNetworkContracts.SavingProduct];

  const { linkRpcProvider } = configSavings.defaultConfigNetwork();

  Logger.debug('Saving Product starts on "%s" network', configSavings.network);
  Logger.debug('WorkQuest network: link Rpc provider "%s"', linkRpcProvider);
  Logger.debug('WorkQuest network contract address: "%s"', contractData.address);

  const web3 = new Web3(new Web3.providers.HttpProvider(linkRpcProvider));

  const transactionsBroker = new TransactionBroker(configDatabase.mqLink, 'saving-product');
  await transactionsBroker.init();

  const clients: SavingProductClients = { web3, transactionsBroker };

  const savingProductContract = new web3.eth.Contract(contractData.getAbi(), contractData.address);

  const savingProductProvider = new SavingProductProvider(
    contractData.address,
    contractData.deploymentHeight,
    clients,
    savingProductContract,
  );

  const savingProductController = new SavingProductController(
    clients,
    configSavings.network as BlockchainNetworks,
    savingProductProvider,
  );

  await new SupervisorContract(
    Logger,
    savingProductController,
    savingProductProvider,
  )
  .startTasks(SupervisorContractTasks.BlockHeightSync)
}

init().catch(e => {
  Logger.error(e, 'Worker "Saving Product" is stopped with error');
  process.exit(-1);
});

