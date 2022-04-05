import fs from "fs";
import Web3 from "web3";
import path from "path";
import childProcess from 'child_process';
import configFetcher from "./fetchers/config/config.fetcher";
import { ContractTransactionsFetcher } from "./fetchers/src/TransactionsFetcher";

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
  const childWqtWbnb = childProcess.fork(path.join(__dirname, '/Wqt-Wbnb/index.js'));
  const childDailyLiquidity = childProcess.fork(path.join(__dirname, '/daily-liquidity/index.js'));

  childProposal.on('exit', (_) => {
    process.exit();
  });
  childBridge.on('exit', (_) => {
    process.exit();
  });
  childPensionFund.on('exit', (_) => {
    process.exit();
  });
  childReferralProgram.on('exit', (_) => {
    process.exit();
  });
  childWqtWbnb.on('exit', (_) => {
    process.exit();
  });
  childDailyLiquidity.on('exit', (_) => {
    process.exit();
  });

  contractTransactionsFetcher
    .addChildFetcher({ childProcess: childProposal, name: 'Proposal', contract: proposalContract, address: proposalContractAddress })
    .addChildFetcher({ childProcess: childBridge, name: 'Bridge', contract: bridgeContract, address: bridgeContractAddress })
    .addChildFetcher({ childProcess: childPensionFund, name: 'Pension fund', contract: pensionFundContract, address: pensionFundContractAddress })
    .addChildFetcher({ childProcess: childReferralProgram, name: 'Referral program', contract: referralProgramContract, address: referralProgramContractAddress })

  await contractTransactionsFetcher.startFetcher();
}

init().catch(e => {
  console.error(e);
  process.exit(e);
});
