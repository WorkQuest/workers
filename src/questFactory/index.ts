import * as path from 'path';
import * as fs from 'fs';
import Web3 from 'web3';
import configFactory from './config/config.questFactory';
import configDatabase from './config/config.database';
import { QuestFactoryController } from './src/controllers/QuestFactoryController';
import { QuestProvider } from './src/providers/QuestProvider';
import { initDatabase, QuestFactoryBlockInfo, BlockchainNetworks } from '@workquest/database-models/lib/models';

const abiFilePath = path.join(__dirname, '../../src/questFactory/abi/QuestFactory.json');
const abi: any[] = JSON.parse(fs.readFileSync(abiFilePath).toString()).abi;

const parseEventsFromHeight = configFactory.workQuestDevNetwork.questFactory.parseEventsFromHeight;
const contractAddress = configFactory.workQuestDevNetwork.questFactory.contractAddress;
const wsLinkProvider = configFactory.workQuestDevNetwork.webSocketProvider;

export async function init() {
  console.log('Start quest factory listener');

  await initDatabase(configDatabase.dbLink, false, true);

  const web3Factory = new Web3(
    new Web3.providers.WebsocketProvider(wsLinkProvider, {
      clientConfig: {
        keepalive: true,
        keepaliveInterval: 60000, // ms
      },
      reconnect: {
        auto: true,
        delay: 1000, // ms
        onTimeout: false,
      },
    }),
  );

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

  const questFactoryContract = new web3Factory.eth.Contract(abi, contractAddress);
  const questFactoryProvider = new QuestProvider(web3Factory, questFactoryContract);
  const questFactoryController = new QuestFactoryController(questFactoryProvider, BlockchainNetworks.workQuestDevNetwork);

  await questFactoryController.collectAllUncollectedEvents(questFactoryInfo.lastParsedBlock);
  await questFactoryProvider.startListener();
}

init().catch(console.error);
