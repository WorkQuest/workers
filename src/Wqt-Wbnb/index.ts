import Web3 from 'web3';
import {Logger} from "../bridge-usdt/logger/pino";
import {NotificationMQClient} from "../middleware";
import configWqtWbnb from './config/config.WqtWbnb';
import configDatabase from './config/config.database';
import {WqtWbnbProvider} from './src/providers/WqtWbnbProvider';
import {WqtWbnbController} from './src/controllers/WqtWbnbController';
import {SupervisorContract, SupervisorContractTasks} from "../supervisor";
import {OraclePricesProvider} from "./src/providers/OraclePricesProvider";
import {BnbNetworkContracts, Networks, Store} from "@workquest/contract-data-pools";
import {initDatabase, BlockchainNetworks} from '@workquest/database-models/lib/models';

export async function init() {
  const contractData = Store[Networks.Bnb][BnbNetworkContracts.WqtWbnb];

  await initDatabase(configDatabase.dbLink, false, true);

  const notificationClient = new NotificationMQClient(configDatabase.notificationMessageBroker, 'daily_liquidity');

  const web3 = new Web3( new Web3.providers.HttpProvider(configWqtWbnb.rpcProvider));

  const wqtWbnbContract = new web3.eth.Contract(contractData.getAbi(), contractData.address);

  const wqtWbnbProvider = new WqtWbnbProvider(
    contractData.address,
    contractData.deploymentHeight,
    web3,
    wqtWbnbContract,
  );

  const wqtWbnbController = new WqtWbnbController(
    web3,
    BlockchainNetworks.bscMainNetwork,
    wqtWbnbProvider,
    notificationClient,
    new OraclePricesProvider(configWqtWbnb.oracleLink),
  );

  await notificationClient.init();

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

