import Web3 from 'web3';
import {Logger} from "../bridge-usdt/logger/pino";
import {NotificationMQClient} from "../middleware";
import configWqtWeth from './config/config.WqtWeth';
import configDatabase from './config/config.database';
import {WqtWethRpcProvider} from './src/providers/WqtWethProvider';
import {WqtWethController} from './src/controllers/WqtWethController';
import {SupervisorContract, SupervisorContractTasks} from "../supervisor";
import {OraclePricesProvider} from "./src/providers/OraclePricesProvider";
import {EthNetworkContracts, Networks, Store} from "@workquest/contract-data-pools";
import {initDatabase, BlockchainNetworks} from '@workquest/database-models/lib/models';

export async function init() {
  const contractData = Store[Networks.Eth][EthNetworkContracts.WqtWeth];

  await initDatabase(configDatabase.dbLink, false, true);

  const web3 = new Web3( new Web3.providers.HttpProvider(configWqtWeth.rpcProvider));
  const wqtWethContract = new web3.eth.Contract(contractData.getAbi(), contractData.address);

  const notificationClient = await new NotificationMQClient(configDatabase.notificationMessageBroker, 'daily_liquidity')
    .on('error', (error) => {
      Logger.error(error, 'Notification client stopped with error');
      process.exit(-1);
    })
    .init()

  const wqtWethProvider = new WqtWethRpcProvider(
    contractData.address,
    contractData.deploymentHeight,
    web3,
    wqtWethContract,
  );

  const wqtWethController = new WqtWethController(
    web3,
    BlockchainNetworks.ethMainNetwork,
    wqtWethProvider,
    notificationClient,
    new OraclePricesProvider(configWqtWeth.oracleLink),
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

