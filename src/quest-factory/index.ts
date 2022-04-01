import Web3 from 'web3';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from 'redis';
import { Logger } from "./logger/pino";
import configDatabase from './config/config.database';
import configQuestFactory from './config/config.questFactory';
import { QuestFactoryClients } from "./src/providers/types";
import { TransactionBroker } from "../brokers/src/TransactionBroker";
import { QuestFactoryProvider } from "./src/providers/QuestFactoryProvider";
import { QuestCacheProvider } from "../quest/src/providers/__mocs__/QuestCacheProvider";
import { QuestFactoryController } from './src/controllers/QuestFactoryController';
import {
  initDatabase,
  BlockchainNetworks,
  QuestFactoryBlockInfo,
} from '@workquest/database-models/lib/models';

const abiFilePath = path.join(__dirname, '../../src/quest-factory/abi/QuestFactory.json');
const abi: any[] = JSON.parse(fs.readFileSync(abiFilePath).toString()).abi;

export async function init() {
  Logger.info('Start worker "Quest factory". Network: "%s"', configQuestFactory.network);

  await initDatabase(configDatabase.dbLink, false, true);

  const { number, url } = configDatabase.redis.defaultConfigNetwork();
  const { linkRpcProvider, contractAddress, parseEventsFromHeight } = configQuestFactory.defaultConfigNetwork();

  Logger.info('Listening on contract address: "%s"', contractAddress);
  Logger.debug('Link Rpc provider: "%s"', linkRpcProvider);

  // const redisClient = createClient({ url, database: number });
  //
  // redisClient.on('error', (e) => {
  //   Logger.error(e, 'Redis is stopped with error');
  //   process.exit(-1);
  // });
  //
  // await redisClient.connect();

  const web3 = new Web3(new Web3.providers.HttpProvider(linkRpcProvider));
  const questFactoryContract = new web3.eth.Contract(abi, contractAddress);

  const transactionBroker = new TransactionBroker(configDatabase.mqLink, 'quest-factory');
  await transactionBroker.init()

  const questCacheProvider = new QuestCacheProvider(/** redisClient as any */);
  const clients: QuestFactoryClients = { web3, questCacheProvider }

  const [questFactoryInfo] = await QuestFactoryBlockInfo.findOrCreate({
    where: { network: BlockchainNetworks.workQuestDevNetwork },
    defaults: {
      network: BlockchainNetworks.workQuestDevNetwork,
      lastParsedBlock: parseEventsFromHeight,
    },
  });

  if (questFactoryInfo.lastParsedBlock < parseEventsFromHeight) {
    questFactoryInfo.lastParsedBlock = parseEventsFromHeight;

    await questFactoryInfo.save();
  }

  const questFactoryProvider = new QuestFactoryProvider(clients, questFactoryContract, transactionBroker);
  const questFactoryController = new QuestFactoryController(clients, questFactoryProvider, configQuestFactory.network as BlockchainNetworks);

  await questFactoryController.collectAllUncollectedEvents(questFactoryInfo.lastParsedBlock);

  await questFactoryProvider.startListener();
}

init().catch(e => {
  Logger.error(e, 'Worker "Quest factory" is stopped with error');
  process.exit(-1);
});
