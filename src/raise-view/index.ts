import Web3 from 'web3';
import {Logger} from "./logger/pino";
import configDatabase from "./config/config.database";
import configRaiseView from "./config/config.raiseView";
import {RaiseViewClients} from "./src/providers/types";
import {TransactionBroker} from "../middleware/src/TransactionBroker";
import {RaiseViewMQProvider} from "./src/providers/RaiseViewProvider";
import {SupervisorContract, SupervisorContractTasks} from "../supervisor";
import {RaiseViewListenerController} from "./src/controllers/RaiseViewController";
import {Store, Networks, WorkQuestNetworkContracts} from "@workquest/contract-data-pools";
import {initDatabase, BlockchainNetworks} from '@workquest/database-models/lib/models';

export async function init() {
  Logger.info('Start worker "Raise view". Network: "%s"', configRaiseView.network);

  await initDatabase(configDatabase.dbLink, false, true);

  const contractData = Store[Networks.WorkQuest][WorkQuestNetworkContracts.Promotion];

  const { linkRpcProvider } = configRaiseView.defaultConfigNetwork();

  Logger.info('Listening on contract address: "%s"', );
  Logger.debug('Link Rpc provider: "%s"', linkRpcProvider);

  const web3 = new Web3(new Web3.providers.HttpProvider(linkRpcProvider));
  const raiseViewContract = new web3.eth.Contract(contractData.getAbi(), contractData.address);

  const transactionsBroker = new TransactionBroker(configDatabase.mqLink, 'raise-view');
  await transactionsBroker.init();

  const clients: RaiseViewClients = { web3, transactionsBroker };

  const raiseViewProvider = new RaiseViewMQProvider(
    contractData.address,
    contractData.deploymentHeight,
    raiseViewContract,
    clients,
  );

  const raiseViewController = new RaiseViewListenerController(
    clients,
    configRaiseView.network as BlockchainNetworks,
    raiseViewProvider,
  );

  await new SupervisorContract(
    Logger,
    raiseViewController,
    raiseViewProvider,
  )
  .setHeightSyncOptions({ period: 300000 })
  .startTasks(SupervisorContractTasks.BlockHeightSync)
}

init().catch(e => {
  Logger.error(e, 'Worker "Raise view" is stopped with error');
  process.exit(-1);
});
