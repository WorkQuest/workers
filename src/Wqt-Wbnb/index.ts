import Web3 from 'web3';
import {Logger} from "../bridge-usdt/logger/pino";
import configWqtWbnb from './config/config.WqtWbnb';
import {WqtWbnbClients} from "./src/providers/types";
import configDatabase from './config/config.database';
import {WqtWbnbRpcProvider} from './src/providers/WqtWbnbProvider';
import {NotificationBroker} from "../brokers/src/NotificationBroker";
import {WqtWbnbController} from './src/controllers/WqtWbnbController';
import {SupervisorContract, SupervisorContractTasks} from "../supervisor";
import {OraclePricesProvider} from "./src/providers/OraclePricesProvider";
import {BnbNetworkContracts, Networks, Store} from "@workquest/contract-data-pools";
import {initDatabase, BlockchainNetworks} from '@workquest/database-models/lib/models';

export async function init() {
  const contractData = Store[Networks.Bnb][BnbNetworkContracts.WqtWbnb];

  await initDatabase(configDatabase.dbLink, false, true);

  const notificationsBroker = new NotificationBroker(configDatabase.notificationMessageBroker, 'daily_liquidity');
  await notificationsBroker.init();

  const web3 = new Web3( new Web3.providers.HttpProvider(configWqtWbnb.rpcProvider));

  const wqtWbnbContract = new web3.eth.Contract(contractData.getAbi(), contractData.address);

  const clients: WqtWbnbClients = { web3, notificationsBroker };

  const wqtWbnbProvider = new WqtWbnbRpcProvider(
    contractData.address,
    contractData.deploymentHeight,
    wqtWbnbContract,
    web3,
  );

  const wqtWbnbController = new WqtWbnbController(
    clients,
    BlockchainNetworks.bscMainNetwork,
    new OraclePricesProvider(configWqtWbnb.oracleLink),
    wqtWbnbProvider,
  );

  await new SupervisorContract(
    Logger,
    wqtWbnbController,
    wqtWbnbProvider,
  )
  .setHeightSyncOptions({ period: 300000 })
  .startTasks(SupervisorContractTasks.BlockHeightSync)
}

init().catch(e => {
  console.error(e);
  process.exit(e);
});

