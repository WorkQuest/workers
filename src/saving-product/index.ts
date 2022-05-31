import Web3 from 'web3';
import { Logger } from "./logger/pino";
import configSavings from "./config/config.savings";
import configDatabase from './config/config.database';
import { SavingProductClients } from "./src/providers/types";
import { TransactionBroker } from "../brokers/src/TransactionBroker";
import { SavingProductProvider } from "./src/providers/SavingProductProvider";
import { SavingProductController } from "./src/controllers/SavingProductController";
import { Networks, Store, WorkQuestNetworkContracts } from "@workquest/contract-data-pools";
import {
  initDatabase,
  BlockchainNetworks,
  SavingProductParseBlock
} from '@workquest/database-models/lib/models';

export async function init() {
  await initDatabase(configDatabase.dbLink, false, true);

  const network = configSavings.network as BlockchainNetworks;
  const contractData = Store[Networks.WorkQuest][WorkQuestNetworkContracts.SavingProduct];

  const {
    linkRpcProvider,
  } = configSavings.defaultConfigNetwork();

  Logger.debug('Saving Product starts on "%s" network', configSavings.network);
  Logger.debug('WorkQuest network: link Rpc provider "%s"', linkRpcProvider);
  Logger.debug('WorkQuest network contract address: "%s"', contractData.address);

  const rpcProvider = new Web3.providers.HttpProvider(linkRpcProvider);

  const web3 = new Web3(rpcProvider);

  const transactionsBroker = new TransactionBroker(configDatabase.mqLink, 'saving-product');
  await transactionsBroker.init();

  const clients: SavingProductClients = { web3, transactionsBroker };

  const savingProductContract = new web3.eth.Contract(contractData.getAbi().abi, contractData.address);

  const savingProductProvider = new SavingProductProvider(clients, savingProductContract);
  const savingProductController = new SavingProductController(clients, network, savingProductProvider);

  const [savingProductBlockInfo] = await SavingProductParseBlock.findOrCreate({
    where: { network },
    defaults: { network, lastParsedBlock: contractData.deploymentHeight },
  });

  await savingProductController.collectAllUncollectedEvents(savingProductBlockInfo.lastParsedBlock);

  await savingProductProvider.startListener();
}

init().catch(e => {
  Logger.error(e, 'Worker "Saving Product" is stopped with error');
  process.exit(-1);
});

