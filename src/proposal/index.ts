import Web3 from 'web3';
import * as fs from 'fs';
import * as path from 'path';
import configProposal from './config/config.proposal';
import configDatabase from './config/config.database';
import { ProposalClients } from './src/providers/types';
import { ProposalController } from "./src/controllers/ProposalController";
import { ChildProcessProvider } from './src/providers/ChildProcessProvider';
import { initDatabase, ProposalParseBlock, BlockchainNetworks } from '@workquest/database-models/lib/models';

const abiFilePath = path.join(__dirname, '../../src/proposal/abi/WQDAOVoting.json');
const abi: any[] = JSON.parse(fs.readFileSync(abiFilePath).toString()).abi;

export async function init() {
  await initDatabase(configDatabase.dbLink, false, true);

  const {
    linkRpcProvider,
    contractAddress,
    parseEventsFromHeight,
  } = configProposal.defaultConfigNetwork();

  const rpcProvider = new Web3.providers.HttpProvider(linkRpcProvider);

  const web3 = new Web3(rpcProvider);

  const clients: ProposalClients = { web3 };

  const proposalContract = new web3.eth.Contract(abi, contractAddress);

  const proposalProvider = new ChildProcessProvider(clients, proposalContract);
  const proposalController = new ProposalController(clients, configProposal.network as BlockchainNetworks, proposalProvider);

  const [proposalBlockInfo] = await ProposalParseBlock.findOrCreate({
    where: { network: configProposal.network as BlockchainNetworks },
    defaults: {
      network: configProposal.network as BlockchainNetworks,
      lastParsedBlock: parseEventsFromHeight,
    },
  });

  if (proposalBlockInfo.lastParsedBlock < parseEventsFromHeight) {
    await proposalBlockInfo.update({
      lastParsedBlock: parseEventsFromHeight
    });
  }

  await proposalController.collectAllUncollectedEvents(proposalBlockInfo.lastParsedBlock);

  console.log('Start proposal listener');

  proposalProvider.startListener();
}

init().catch(e => {
  console.error(e);
  process.exit(e);
});

