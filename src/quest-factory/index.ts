import * as path from 'path';
import * as fs from 'fs';
import Web3 from 'web3';
import { createClient } from 'redis';
import {QuestFactoryClients} from "./src/providers/types";
import configDatabase from './config/config.database';
import configQuestFactory from './config/config.questFactory';
import { QuestFactoryController } from './src/controllers/QuestFactoryController';
import { WebsocketClient as TendermintWebsocketClient } from "@cosmjs/tendermint-rpc";
import { initDatabase, QuestFactoryBlockInfo, BlockchainNetworks } from '@workquest/database-models/lib/models';
import { QuestCacheProvider } from "../quest/src/providers/QuestCacheProvider";
import { ChildProcessProvider } from "./src/providers/ChildProcessProvider";

const abiFilePath = path.join(__dirname, '../../src/quest-factory/abi/QuestFactory.json');
const abi: any[] = JSON.parse(fs.readFileSync(abiFilePath).toString()).abi;

export async function init() {
  await initDatabase(configDatabase.dbLink, false, true);

  const { number, url } = configDatabase.redis.defaultConfigNetwork();
  const { linkRpcProvider, contractAddress, parseEventsFromHeight, linkTendermintProvider } = configQuestFactory.defaultConfigNetwork();

  const redisClient = createClient({ url, database: number });

  await redisClient.on('error', (err) => { throw err });
  await redisClient.connect();

  const tendermintWsClient = new TendermintWebsocketClient(linkTendermintProvider, error => {
    throw error;
  });

  const web3 = new Web3(new Web3.providers.HttpProvider(linkRpcProvider));
  const questFactoryContract = new web3.eth.Contract(abi, contractAddress);
  // @ts-ignore
  const questCacheProvider = new QuestCacheProvider(redisClient);
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

  const questFactoryProvider = new ChildProcessProvider(clients, questFactoryContract);
  const questFactoryController = new QuestFactoryController(clients, questFactoryProvider, configQuestFactory.network as BlockchainNetworks);

  await questFactoryController.collectAllUncollectedEvents(questFactoryInfo.lastParsedBlock);

  questFactoryProvider.startListener();
}

init().catch(console.error);
