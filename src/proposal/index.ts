import * as path from 'path';
import * as fs from 'fs';
import Web3 from 'web3';
import configProposal from './config/config.proposal';
import configDatabase from './config/config.database';
import { initDatabase, ProposalParseBlock, BlockchainNetworks } from '@workquest/database-models/lib/models';
import { WebsocketClient as TendermintWebsocketClient } from "@cosmjs/tendermint-rpc";
import { ProposalController } from "./src/controllers/ProposalController";
import { ProposalProvider } from './src/providers/ProposalProvider';


const abiFilePath = path.join(__dirname, '../../src/proposal/abi/WQDAOVoting.json');
const abi: any[] = JSON.parse(fs.readFileSync(abiFilePath).toString()).abi;

export async function init() {
  console.log('Start listener proposal'); // TODO add pino

  await initDatabase(configDatabase.dbLink, false, true);

  const { linkRpcProvider, contractAddress, parseEventsFromHeight, linkTendermintProvider } = configProposal.defaultConfigNetwork();

  const rpcProvider = new Web3.providers.HttpProvider(linkRpcProvider);
  const tendermintWsProvider = new TendermintWebsocketClient(linkTendermintProvider, err => {
    throw err;
  });

  const web3 = new Web3(rpcProvider);

  const proposalContract = new web3.eth.Contract(abi, contractAddress);

  // @ts-ignore
  const proposalProvider = new ProposalProvider(web3, tendermintWsProvider, proposalContract);
  const proposalController = new ProposalController(proposalProvider, configProposal.network as BlockchainNetworks);

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

init().catch(console.error);
