import * as path from 'path';
import * as fs from 'fs';
import Web3 from 'web3';
import { createClient } from 'redis';
import configDatabase from './config/config.database';
import configQuestFactory from './config/config.questFactory';
import { QuestFactoryProvider } from './src/providers/QuestFactoryProvider';
import { QuestFactoryController } from './src/controllers/QuestFactoryController';
import { WebsocketClient as TendermintWebsocketClient } from "@cosmjs/tendermint-rpc";
import { initDatabase, QuestFactoryBlockInfo, BlockchainNetworks } from '@workquest/database-models/lib/models';
import {QuestFactoryCacheProvider} from "./src/providers/QuestFactoryCacheProvider";

const abiFilePath = path.join(__dirname, '../../src/questFactory/abi/QuestFactory.json');
const abi: any[] = JSON.parse(fs.readFileSync(abiFilePath).toString()).abi;

export async function init() {
  await initDatabase(configDatabase.dbLink, false, true);

  const redisConfig = configDatabase.redis.defaultConfigNetwork();
  const { linkRpcProvider, contractAddress, parseEventsFromHeight, linkTendermintProvider } = configQuestFactory.defaultConfigNetwork();

  const redisClient = createClient(redisConfig);

  await redisClient.on('error', (err) => { throw err });
  await redisClient.connect();

  const rpcProvider = new Web3.providers.HttpProvider(linkRpcProvider);
  const tendermintWsProvider = new TendermintWebsocketClient(linkTendermintProvider, error => {
    throw error;
  });

  const web3 = new Web3(rpcProvider);
  const questFactoryContract = new web3.eth.Contract(abi, contractAddress);

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

  // @ts-ignore
  const questFactoryCacheProvider = new QuestFactoryCacheProvider(redisClient);
  const questFactoryProvider = new QuestFactoryProvider(web3, tendermintWsProvider, questFactoryContract);
  const questFactoryController = new QuestFactoryController(questFactoryProvider, questFactoryCacheProvider, configQuestFactory.network as BlockchainNetworks);

  await questFactoryController.collectAllUncollectedEvents(questFactoryInfo.lastParsedBlock);
  await questFactoryProvider.startListener();
}

init().catch(console.error);
