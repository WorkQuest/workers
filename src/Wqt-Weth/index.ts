import Web3 from 'web3';
import {SupervisorContract, SupervisorContractTasks} from "../supervisor";
import {Logger} from "../bridge-usdt/logger/pino";
import configWqtWeth from './config/config.WqtWeth';
import configDatabase from './config/config.database';
import {WqtWethClients} from "./src/providers/types";
import {WqtWethRpcProvider} from './src/providers/WqtWethProvider';
import {NotificationBroker} from "../middleware/src/NotificationBroker";
import {WqtWethController} from './src/controllers/WqtWethController';
import {OraclePricesProvider} from "./src/providers/OraclePricesProvider";
import {EthNetworkContracts, Networks, Store} from "@workquest/contract-data-pools";
import {initDatabase, BlockchainNetworks} from '@workquest/database-models/lib/models';

export async function init() {
  const contractData = Store[Networks.Eth][EthNetworkContracts.WqtWeth];

  await initDatabase(configDatabase.dbLink, false, true);

  const notificationsBroker = new NotificationBroker(configDatabase.notificationMessageBroker, 'daily_liquidity');
  await notificationsBroker.init();

  const web3 = new Web3( new Web3.providers.HttpProvider(configWqtWeth.rpcProvider));

  const wqtWethContract = new web3.eth.Contract(contractData.getAbi(), contractData.address);

  const clients: WqtWethClients = { web3, notificationsBroker };

  const wqtWethProvider = new WqtWethRpcProvider(
    contractData.address,
    contractData.deploymentHeight,
    wqtWethContract,
    clients,
  );

  const wqtWethController = new WqtWethController(
    clients,
    BlockchainNetworks.ethMainNetwork,
    new OraclePricesProvider(configWqtWeth.oracleLink),
    wqtWethProvider,
  );

  await new SupervisorContract(
    Logger,
    wqtWethController,
    wqtWethProvider,
  )
  .setHeightSyncOptions({ period: 300000 })
  .startTasks(SupervisorContractTasks.BlockHeightSync)
}

init().catch(e => {
  console.error(e);
  process.exit(e);
});

