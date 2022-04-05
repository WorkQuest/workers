import Web3 from 'web3';
import * as fs from 'fs';
import * as path from 'path';
import configDatabase from './config/config.database';
import configPensionFund from './config/config.pensionFund';
import { BlockchainNetworks, initDatabase, PensionFundBlockInfo } from '@workquest/database-models/lib/models';
import { PensionFundController } from "./src/controllers/pensionFundController";
import { WebsocketClient as TendermintWebsocketClient } from "@cosmjs/tendermint-rpc";
import { Clients } from "./src/providers/types";
import { ChildProcessProvider } from "./src/providers/ChildProcessProvider";
import { Logger } from "./logger/pino";

const abiFilePath = path.join(__dirname, '/abi/WQPensionFund.json');
const abi: any[] = JSON.parse(fs.readFileSync(abiFilePath).toString()).abi;

export async function init() {
  await initDatabase(configDatabase.dbLink, true, false);

  const {
    linkRpcProvider,
    contractAddress,
    parseEventsFromHeight,
  } = configPensionFund.defaultConfigNetwork();

  const rpcProvider = new Web3.providers.HttpProvider(linkRpcProvider);

  const web3 = new Web3(rpcProvider);

  const clients: Clients = { web3 };

  const pensionFundContract = new web3.eth.Contract(abi, contractAddress);

  const pensionFundProvider = new ChildProcessProvider(clients, pensionFundContract);
  const pensionFundController = new PensionFundController(clients, configPensionFund.network as BlockchainNetworks, pensionFundProvider);

  const [pensionFundBlockInfo] = await PensionFundBlockInfo.findOrCreate({
    where: { network: BlockchainNetworks.workQuestNetwork },
    defaults: {
      network: BlockchainNetworks.workQuestNetwork,
      lastParsedBlock: parseEventsFromHeight,
    },
  });

  await pensionFundController.collectAllUncollectedEvents(pensionFundBlockInfo.lastParsedBlock);

  Logger.info('Start pension fund listener');

  await pensionFundProvider.startListener();
}

init().catch(e => {
  Logger.error(e, 'Worker "Pension Fund" is stopped with error');
  process.exit(-1);
});

