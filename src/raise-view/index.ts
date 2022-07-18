import Web3 from 'web3';
import {Logger} from "./logger/pino";
import {TransactionMQListener} from "../middleware";
import configDatabase from "./config/config.database";
import configRaiseView from "./config/config.raiseView";
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

  const transactionListener = await new TransactionMQListener(configDatabase.mqLink, 'raise-view')
    .on('error', (error) => {
      Logger.error(error, 'Transaction listener stopped with error');
      process.exit(-1);
    })
    .init()

  const raiseViewProvider = new RaiseViewMQProvider(
    contractData.address,
    contractData.deploymentHeight,
    web3,
    raiseViewContract,
    Logger.child({
      target: `RaiseViewMQProvider ("${configRaiseView.network})"`,
    }),
    transactionListener,
  );

  const raiseViewController = new RaiseViewListenerController(
    web3,
    Logger.child({
      target: `RaiseViewListenerController ("${configRaiseView.network})"`,
    }),
    configRaiseView.network as BlockchainNetworks,
    raiseViewProvider,
  );

  await new SupervisorContract(
    Logger.child({
      target: `SupervisorContract ("${configRaiseView.network})"`,
    }),
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
