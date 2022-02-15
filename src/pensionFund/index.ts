import Web3 from 'web3';
import * as fs from 'fs';
import * as path from 'path';
import configDatabase from './config/config.database';
import configPensionFund from './config/config.pensionFund';
import { BlockchainNetworks, initDatabase, PensionFundBlockInfo} from '@workquest/database-models/lib/models';
import { PensionFundController } from "./src/controllers/pensionFundController";
import { PensionFundProvider } from "./src/providers/pensionFundProvider"
import { WebsocketClient as TendermintWebsocketClient } from "@cosmjs/tendermint-rpc";

const abiFilePath = path.join(__dirname, '/abi/WQPensionFund.json');
const abi: any[] = JSON.parse(fs.readFileSync(abiFilePath).toString()).abi;

export async function init() {
  await initDatabase(configDatabase.dbLink, true, true);

  const rpcProvider = new Web3.providers.HttpProvider(configPensionFund.rpcProvider);
  const tendermintWsProvider = new TendermintWebsocketClient(configPensionFund.tendermintProvider, error => {
    throw error;
  });

  const web3 = new Web3(rpcProvider);

  const pensionFundContract = new web3.eth.Contract(abi, configPensionFund.contractAddress);

  // @ts-ignore
  const pensionFundProvider = new PensionFundProvider(web3, tendermintWsProvider, pensionFundContract);
  const pensionFundController = new PensionFundController(pensionFundProvider, BlockchainNetworks.workQuestNetwork);

  const [pensionFundBlockInfo] = await PensionFundBlockInfo.findOrCreate({
    where: { network: BlockchainNetworks.workQuestNetwork },
    defaults: {
      network: BlockchainNetworks.workQuestNetwork,
      lastParsedBlock: configPensionFund.parseEventsFromHeight,
    },
  });

  // await pensionFundController.collectAllUncollectedEvents(pensionFundBlockInfo.lastParsedBlock);

  console.log('Start pension fund listener');

 await pensionFundProvider.startListener();
}

init().catch(console.error);
