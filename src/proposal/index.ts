import * as path from 'path';
import * as fs from 'fs';
import Web3 from 'web3';
import configProposal from './config/config.proposal';
import configDatabase from './config/config.database';
import { ProposalContract } from './src/ProposalContract';
import { ProposalEthListener } from './src/ProviderListener';
import { ProposalProvider } from './src/ProposalProvider';
import { initDatabase, BlockchainNetworks, ProposalParseBlock } from '@workquest/database-models/lib/models';

const abiFilePath = path.join(__dirname, '../../src/proposal/abi/WQDAOVoting.json');
const abi: any[] = JSON.parse(fs.readFileSync(abiFilePath).toString()).abi;

// TODO Only test network
const parseEthEventsFromHeight = configProposal.rinkebyTestNetwork.parseEventsFrom;
const contractEthAddress = configProposal.rinkebyTestNetwork.contract;
const urlEthProvider = configProposal.rinkebyTestNetwork.webSocketProvider;

export async function init() {
  console.log('Start listener proposal'); // TODO add pino

  await initDatabase(configDatabase.dbLink, false, true);

  const web3Eth = new Web3(
    new Web3.providers.WebsocketProvider(urlEthProvider, {
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

  const [proposalInfo] = await ProposalParseBlock.findOrCreate({
    where: { network: BlockchainNetworks.ethMainNetwork },
    defaults: {
      network: BlockchainNetworks.ethMainNetwork,
      lastParsedBlock: parseEthEventsFromHeight,
    },
  });

  if (proposalInfo.lastParsedBlock < parseEthEventsFromHeight) {
    proposalInfo.lastParsedBlock = parseEthEventsFromHeight;

    await proposalInfo.save();
  }

  const proposalEthProvider = new ProposalProvider(web3Eth, proposalInfo.lastParsedBlock);
  const proposalEthContract = new ProposalContract(proposalEthProvider, contractEthAddress, abi);
  const proposalEthListener = new ProposalEthListener(proposalEthContract, proposalInfo);

  await proposalEthListener.parseProposalCreated();
  await proposalEthListener.start();
}

init().catch(console.error);
