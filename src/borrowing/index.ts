import { WebsocketClient as TendermintWebsocketClient } from "@cosmjs/tendermint-rpc/build/rpcclients/websocketclient";
import { BlockchainNetworks, BorrowingParseBlock, initDatabase } from "@workquest/database-models/lib/models";
import { BorrowingController } from "./src/controllers/BorrowingController";
import { BorrowingProvider } from "./src/providers/BorrowingProvider";
import configBorrowing from "./config/config.borrowing";
import configDatabase from "./config/config,database";
import path from "path";
import Web3 from "web3";
import fs from "fs";

const abiFilePath = path.join(__dirname, '../../src/borrowing/abi/WQBorrowing.json');
const abi: any[] = JSON.parse(fs.readFileSync(abiFilePath).toString()).abi;

export async function init() {
  await initDatabase(configDatabase.dbLink, false, true);

  const {
    linkRpcProvider,
    contractAddress,
    parseEventsFromHeight,
    linkTendermintProvider,
  } = configBorrowing.defaultConfigNetwork();

  const rpcProvider = new Web3.providers.HttpProvider(linkRpcProvider);
  const tendermintWsProvider = new TendermintWebsocketClient(linkTendermintProvider, err => {
    throw err;
  });

  const web3 = new Web3(rpcProvider);

  const borrowingContract = new web3.eth.Contract(abi, contractAddress);

  // @ts-ignore
  const borrowingProvider = new BorrowingProvider(web3, tendermintWsProvider, borrowingContract);
  const borrowingController = new BorrowingController(borrowingProvider, configBorrowing.network as BlockchainNetworks);

  const [borrowingBlockInfo] = await BorrowingParseBlock.findOrCreate({
    where: { network: configBorrowing.network as BlockchainNetworks },
    defaults: {
      network: configBorrowing.network as BlockchainNetworks,
      lastParsedBlock: parseEventsFromHeight,
    },
  });

  if (borrowingBlockInfo.lastParsedBlock < parseEventsFromHeight) {
    await borrowingBlockInfo.update({
      lastParsedBlock: parseEventsFromHeight
    });
  }

  await borrowingController.collectAllUncollectedEvents(borrowingBlockInfo.lastParsedBlock);

  console.log('Start borrowing listener');

  borrowingProvider.startListener();
}

init().catch(console.error);
