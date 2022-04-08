import Web3 from 'web3';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from 'redis';
import { Logger } from "./logger/pino";
import { RaiseViewClients } from "./src/providers/types";
import { TransactionBroker } from "../brokers/src/TransactionBroker";

import {
  initDatabase,
  BlockchainNetworks,
  RaiseViewBlockInfo,
} from '@workquest/database-models/lib/models';
import configRaiseView from "./config/config.raiseView";
import configDatabase from "./config/configDatabase";
import { RaiseViewProvider } from "./src/providers/RaiseViewProvider";
import { RaiseViewController } from "./src/controllers/RaiseViewController";

const abiFilePath = path.join(__dirname, '../../src/quest-factory/abi/QuestFactory.json');
const abi: any[] = JSON.parse(fs.readFileSync(abiFilePath).toString()).abi;

export async function init() {
  Logger.info('Start worker "Quest factory". Network: "%s"', configRaiseView.network);

  await initDatabase(configDatabase.dbLink, false, true);

  const { number, url } = configDatabase.redis.defaultConfigNetwork();
  const { linkRpcProvider, contractAddress, parseEventsFromHeight } = configRaiseView.defaultConfigNetwork();

  Logger.info('Listening on contract address: "%s"', contractAddress);
  Logger.debug('Link Rpc provider: "%s"', linkRpcProvider);

  const redisClient = createClient({ url, database: number });

  redisClient.on('error', (e) => {
    Logger.error(e, 'Redis is stopped with error');
    process.exit(-1);
  });

  await redisClient.connect();

  const web3 = new Web3(new Web3.providers.HttpProvider(linkRpcProvider));
  const questFactoryContract = new web3.eth.Contract(abi, contractAddress);

  const transactionsBroker = new TransactionBroker(configDatabase.mqLink, 'quest-factory');
  await transactionsBroker.init()

  const clients: RaiseViewClients = { web3, transactionsBroker };

  const [raiseViewBlockInfo] = await RaiseViewBlockInfo.findOrCreate({
    where: { network: BlockchainNetworks.workQuestDevNetwork },
    defaults: {
      network: BlockchainNetworks.workQuestDevNetwork,
      lastParsedBlock: parseEventsFromHeight,
    },
  });

  if (raiseViewBlockInfo.lastParsedBlock < parseEventsFromHeight) {
    raiseViewBlockInfo.lastParsedBlock = parseEventsFromHeight;

    await raiseViewBlockInfo.save();
  }

  const questFactoryProvider = new RaiseViewProvider(clients, questFactoryContract);
  const questFactoryController = new RaiseViewController(clients, questFactoryProvider, configRaiseView.network as BlockchainNetworks);

  await questFactoryController.collectAllUncollectedEvents(raiseViewBlockInfo.lastParsedBlock);

  await questFactoryProvider.startListener();
}

init().catch(e => {
  Logger.error(e, 'Worker "Quest factory" is stopped with error');
  process.exit(-1);
});
