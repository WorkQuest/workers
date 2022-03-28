import Web3 from 'web3';
import * as fs from 'fs';
import * as path from 'path';
import configDatabase from './config/config.database';
import {ReferralClients} from "./src/providers/types";
import configReferral from './config/config.referral';
import { ReferralController } from "./src/controllers/ReferralController";
import { ReferralMessageBroker } from "./src/controllers/BrokerController";
import { ChildProcessProvider } from "./src/providers/ChildProcessProvider";
import {
  initDatabase,
  BlockchainNetworks,
  ReferralProgramParseBlock,
} from '@workquest/database-models/lib/models';

const abiFilePath = path.join(__dirname, '/abi/WQReferral.json');
const abi: any[] = JSON.parse(fs.readFileSync(abiFilePath).toString()).abi;

export async function init() {
  ReferralMessageBroker.initMessageBroker();

  await initDatabase(configDatabase.dbLink, true, false);

  const network = configReferral.network as BlockchainNetworks;

  const {
    linkRpcProvider,
    contractAddress,
    parseEventsFromHeight,
  } = configReferral.defaultConfigNetwork();

  const rpcProvider = new Web3.providers.HttpProvider(linkRpcProvider);

  const web3 = new Web3(rpcProvider);
  const referralContract = new web3.eth.Contract(abi, contractAddress);
  const clients: ReferralClients = { web3 };

  const referralProvider = new ChildProcessProvider(clients, referralContract);
  const referralController = new ReferralController(clients, network, referralProvider);

  const [referralBlockInfo, _] = await ReferralProgramParseBlock.findOrCreate({
    where: { network },
    defaults: { network, lastParsedBlock: parseEventsFromHeight },
  });

  await referralController.collectAllUncollectedEvents(referralBlockInfo.lastParsedBlock);

  console.log('Start referral-program program listener');

  referralProvider.startListener();
}

init().catch(e => {
  console.error(e);
  process.exit(e);
});

