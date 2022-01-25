import Web3 from 'web3';
import * as fs from 'fs';
import * as path from 'path';
import { WqtWbnbProvider } from './src/providers/WqtWbnbProvider';
import { WqtWbnbController } from './src/controllers/WqtWbnbController';
import configDatabase from './config/config.database';
import configWqtWbnb from './config/config.WqtWbnb';
import { CoinGeckoProvider } from './src/providers/CoinGeckoProvider';
import { BlockchainNetworks, initDatabase, WqtWbnbBlockInfo } from '@workquest/database-models/lib/models';

const abiFilePath = path.join(__dirname, '/abi/WqtWbnb.json');
const abi: any[] = JSON.parse(fs.readFileSync(abiFilePath).toString()).abi;

export async function init() {
  await initDatabase(configDatabase.dbLink, true, true);

  const websocketProvider = new Web3.providers.WebsocketProvider(configWqtWbnb.wsProvider, {
    reconnect: {
      auto: true,
      delay: 10000,
      onTimeout: false,
    },
  });

  const web3 = new Web3(websocketProvider);
  const wqtWbnbContract = new web3.eth.Contract(abi, configWqtWbnb.contractAddress);

  // @ts-ignore
  const wqtWbnbProvider = new WqtWbnbProvider(web3, wqtWbnbContract);
  const wqtWbnbController = new WqtWbnbController(wqtWbnbProvider, new CoinGeckoProvider(), BlockchainNetworks.bscMainNetwork);

  const [wqtWbnbBlockInfo] = await WqtWbnbBlockInfo.findOrCreate({
    where: { network: BlockchainNetworks.bscMainNetwork },
    defaults: {
      network: BlockchainNetworks.bscMainNetwork,
      lastParsedBlock: configWqtWbnb.parseEventsFromHeight,
    },
  });

  await wqtWbnbController.collectAllUncollectedEvents(wqtWbnbBlockInfo.lastParsedBlock);

  console.log('Start swap listener');

  await wqtWbnbProvider.startListener();
}

init().catch(console.error);
