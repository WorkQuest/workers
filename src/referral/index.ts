import Web3 from 'web3';
import * as fs from 'fs';
import * as path from 'path';
import configDatabase from './config/config.database';
import configReferral from './config/config.referral';
import { ReferralProvider } from "./src/providers/referralProvider"
import { ReferralController } from "./src/controllers/ReferralController";
import { WebsocketClient as TendermintWebsocketClient } from "@cosmjs/tendermint-rpc";
import { BlockchainNetworks, ReferralParseBlock, initDatabase } from '@workquest/database-models/lib/models';

const abiFilePath = path.join(__dirname, '/abi/WQReferral.json');
const abi: any[] = JSON.parse(fs.readFileSync(abiFilePath).toString()).abi;

export async function init() {
  await initDatabase(configDatabase.dbLink, true, true);

  const rpcProvider = new Web3.providers.HttpProvider(configReferral.workQuestDevNetwork.rpcProvider);
  const tendermintWsProvider = new TendermintWebsocketClient(configReferral.workQuestDevNetwork.tendermintProvider, error => {
    throw error;
  });

  const web3 = new Web3(rpcProvider);

  const referralContract = new web3.eth.Contract(abi, configReferral.workQuestDevNetwork.contractAddress);

  // @ts-ignore
  const referralProvider = new ReferralProvider(web3, tendermintWsProvider, referralContract);
  const referralController = new ReferralController(referralProvider, BlockchainNetworks.workQuestNetwork);

  const [referralBlockInfo] = await ReferralParseBlock.findOrCreate({
    where: { network: BlockchainNetworks.workQuestNetwork },
    defaults: {
      network: BlockchainNetworks.workQuestNetwork,
      lastParsedBlock: configReferral.workQuestDevNetwork.parseEventsFromHeight,
    },
  });

  await referralController.collectAllUncollectedEvents(referralBlockInfo.lastParsedBlock);

  console.log('Start referral program listener');

  await referralProvider.startListener();
}

init().catch(console.error);
