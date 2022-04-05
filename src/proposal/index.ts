import * as path from 'path';
import * as fs from 'fs';
import Web3 from 'web3';
import configProposal from './config/config.proposal';
import configDatabase from './config/config.database';
import { ProposalController } from "./src/controllers/ProposalController";
import { ProposalBrokerProvider } from './src/providers/ProposalBrokerProvider';
import { initDatabase, ProposalParseBlock, BlockchainNetworks } from '@workquest/database-models/lib/models';
import { Clients } from "./src/providers/types";
import { TransactionBroker } from "../brokers/src/TransactionBroker";

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

  const transactionsBroker = new TransactionBroker(configDatabase.mqLink, 'proposal');
  await transactionsBroker.init();

  const clients: Clients = { web3, transactionsBroker };

  const proposalContract = new web3.eth.Contract(abi, contractAddress);

  const proposalProvider = new ProposalBrokerProvider(clients, proposalContract);
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

  await proposalProvider.startListener();
}

init().catch(e => {
  console.error(e);
  process.exit(e);
});

