import fs from "fs";
import Web3 from "web3";
import path from "path";
import {createClient} from "redis";
import childProcess from 'child_process';
import configDatabase from './quest/config/config.database';
import configFetcher from "./fetchers/config/config.fetcher";
import { QuestCacheProvider } from './quest/src/providers/QuestCacheProvider';
import { ContractTransactionsFetcher } from "./fetchers/ContractTransactionsFetcher";

const bridgeAbiFilePath = path.join(__dirname, '/bridge/abi/WQBridge.json');
const bridgeAbi: any[] = JSON.parse(fs.readFileSync(bridgeAbiFilePath).toString()).abi;

const proposalAbiFilePath = path.join(__dirname, '/proposal/abi/WQDAOVoting.json');
const proposalAbi: any[] = JSON.parse(fs.readFileSync(proposalAbiFilePath).toString()).abi;

const pensionFundAbiFilePath = path.join(__dirname, '/pension-fund/abi/WQPensionFund.json');
const pensionFundAbi: any[] = JSON.parse(fs.readFileSync(pensionFundAbiFilePath).toString()).abi;

const referralProgramAbiFilePath = path.join(__dirname, '/referral-program/abi/WQReferral.json');
const referralProgramAbi: any[] = JSON.parse(fs.readFileSync(referralProgramAbiFilePath).toString()).abi;

const questFactoryAbiFilePath = path.join(__dirname, '/quest-factory/abi/QuestFactory.json');
const questFactoryAbi: any[] = JSON.parse(fs.readFileSync(questFactoryAbiFilePath).toString()).abi;

async function init() {
  const {
    linkRpcProvider,
    bridgeContractAddress,
    proposalContractAddress,
    pensionFundContractAddress,
    referralProgramContractAddress,
    questFactoryContractAddress,
  } = configFetcher.defaultConfigNetwork();

  const redisConfig = configDatabase.redis.defaultConfigNetwork();
  const redisClient = createClient(redisConfig);
  await redisClient.on('error', (err) => { throw err });
  await redisClient.connect();

  // @ts-ignore
  const questCacheProvider = new QuestCacheProvider(redisClient);

  const rpcProvider = new Web3.providers.HttpProvider(linkRpcProvider);
  const web3 = new Web3(rpcProvider);

  const contractTransactionsFetcher = new ContractTransactionsFetcher(web3);

  const proposalContract = new web3.eth.Contract(proposalAbi, proposalContractAddress);
  const bridgeContract = new web3.eth.Contract(bridgeAbi, bridgeContractAddress);
  const pensionFundContract = new web3.eth.Contract(pensionFundAbi, pensionFundContractAddress);
  const referralProgramContract = new web3.eth.Contract(referralProgramAbi, referralProgramContractAddress);
  const questFactoryContract = new web3.eth.Contract(questFactoryAbi, questFactoryContractAddress);

  // const childProposal = childProcess.fork(path.join(__dirname, '/proposal/index.js'));
  // const childBridge = childProcess.fork(path.join(__dirname, '/bridge/index.js'));
  // const childPensionFund = childProcess.fork(path.join(__dirname, '/pension-fund/index.js'));
  // const childReferralProgram = childProcess.fork(path.join(__dirname, '/referral-program/index.js'));
  const childQuest = childProcess.fork(path.join(__dirname, '/quest/index.js'));
  const childQuestFactory = childProcess.fork(path.join(__dirname, '/quest-factory/index.js'));

  // childProposal.on('exit', (_) => {
  //   process.exit();
  // });
  // childBridge.on('exit', (_) => {
  //   process.exit();
  // });
  // childPensionFund.on('exit', (_) => {
  //   process.exit();
  // });
  // childReferralProgram.on('exit', (_) => {
  //   process.exit();
  // });
  childQuest.on('exit', (_) => {
    process.exit();
  });
  childQuestFactory.on('exit', (_) => {
    process.exit();
  });

  contractTransactionsFetcher
    .addFactoryContractsWorker({ childProcess: childQuest, name: 'Quest', cacheProvider: questCacheProvider })
    .addSingleContractWorker({ childProcess: childQuestFactory, name: 'Quest-factory', contract: questFactoryContract, address: questFactoryContractAddress })
    // .addSingleContractWorker({ childProcess: childProposal, name: 'Proposal', contract: proposalContract, address: proposalContractAddress })
    // .addSingleContractWorker({ childProcess: childBridge, name: 'Bridge', contract: bridgeContract, address: bridgeContractAddress })
    // .addSingleContractWorker({ childProcess: childPensionFund, name: 'Pension-fund', contract: pensionFundContract, address: pensionFundContractAddress })
    // .addSingleContractWorker({ childProcess: childReferralProgram, name: 'Referral-program', contract: referralProgramContract, address: referralProgramContractAddress })

  await contractTransactionsFetcher.startFetcher();
}

init().catch(e => {
  console.error(e);
  process.exit(e);
});
