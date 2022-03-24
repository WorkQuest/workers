import fs from "fs";
import Web3 from "web3";
import path from "path";
import childProcess from 'child_process';
import configFetcher from "./fetchers/config/config.fetcher";
import {ContractTransactionsFetcher} from "./fetchers/ContractTransactionsFetcher";

const bridgeAbiFilePath = path.join(__dirname,  '/../src/bridge/abi/WQBridge.json');
const bridgeAbi: any[] = JSON.parse(fs.readFileSync(bridgeAbiFilePath).toString()).abi;

const proposalAbiFilePath = path.join(__dirname,  '/../src/proposal/abi/WQDAOVoting.json');
const proposalAbi: any[] = JSON.parse(fs.readFileSync(proposalAbiFilePath).toString()).abi;

const pensionFundAbiFilePath = path.join(__dirname,  '/../src/pension-fund/abi/WQPensionFund.json');
const pensionFundAbi: any[] = JSON.parse(fs.readFileSync(pensionFundAbiFilePath).toString()).abi;

const referralProgramAbiFilePath = path.join(__dirname,  '/../src/referral-program/abi/WQReferral.json');
const referralProgramAbi: any[] = JSON.parse(fs.readFileSync(referralProgramAbiFilePath).toString()).abi;

async function init() {
  const {
    linkRpcProvider,
    bridgeContractAddress,
    proposalContractAddress,
    pensionFundContractAddress,
    referralProgramContractAddress,
  } = configFetcher.defaultConfigNetwork();

  const rpcProvider = new Web3.providers.HttpProvider(linkRpcProvider);
  const web3 = new Web3(rpcProvider);

  const contractTransactionsFetcher = new ContractTransactionsFetcher(web3);

  const proposalContract = new web3.eth.Contract(proposalAbi, proposalContractAddress);
  const bridgeContract = new web3.eth.Contract(bridgeAbi, bridgeContractAddress);
  const pensionFundContract = new web3.eth.Contract(pensionFundAbi, pensionFundContractAddress);
  const referralProgramContract = new web3.eth.Contract(referralProgramAbi, referralProgramContractAddress);

  const childProposal = childProcess.fork(path.join(__dirname, '/proposal/index.js'));
  const childBridge = childProcess.fork(path.join(__dirname, '/bridge/index.js'));
  const childPensionFund = childProcess.fork(path.join(__dirname, '/pension-fund/index.js'));
  const childReferralProgram = childProcess.fork(path.join(__dirname, '/referral-program/index.js'));

  contractTransactionsFetcher
    .addContractAddresses({ childProcess: childProposal, name: 'proposal', contract: proposalContract })
    .addContractAddresses({ childProcess: childBridge, name: 'Bridge', contract: bridgeContract })
    .addContractAddresses({ childProcess: childPensionFund, name: 'Pension fund', contract: pensionFundContract })
    .addContractAddresses({ childProcess: childReferralProgram, name: 'Referral program', contract: referralProgramContract })

  await contractTransactionsFetcher.startFetcher();
}

init().catch(e => {
  throw e;
});
