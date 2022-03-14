import { WebsocketClient as TendermintWebsocketClient } from "@cosmjs/tendermint-rpc";
import { BlockchainNetworks, initDatabase, WqtParseBlock } from "@workquest/database-models/lib/models";
import { WqtController } from "./src/controllers/WqtController";
import { WqtProvider } from "./src/providers/WqtProvider";
import configDatabase from "./config/config.database";
import configWqt from "./config/config.wqt";
import path from "path";
import Web3 from "web3";
import fs from "fs";

const abiFilePath = path.join(__dirname, '../../src/wqt/abi/WQToken.json');
const abi: any[] = JSON.parse(fs.readFileSync(abiFilePath).toString()).abi;

export async function init() {
  await initDatabase(configDatabase.dbLink, false, true);

  const {
    linkRpcProvider,
    contractAddress,
    parseEventsFromHeight,
    linkTendermintProvider
  } = configWqt.defaultConfigNetwork();

  const rpcProvider = new Web3.providers.HttpProvider(linkRpcProvider);
  const tendermintWsProvider = new TendermintWebsocketClient(linkTendermintProvider, err => {
    throw err;
  });

  const web3 = new Web3(rpcProvider);

  const wqtContract = new web3.eth.Contract(abi, contractAddress);

  // @ts-ignore
  const wqtProvider = new WqtProvider(web3, tendermintWsProvider, wqtContract);
  const wqtController = new WqtController(wqtProvider, configWqt.network as BlockchainNetworks);

  const [wqtBlockInfo] = await WqtParseBlock.findOrCreate({
    where: { network: configWqt.network as BlockchainNetworks },
    defaults: {
      network: configWqt.network as BlockchainNetworks,
      lastParsedBlock: parseEventsFromHeight,
    }
  });

  if (wqtBlockInfo.lastParsedBlock < parseEventsFromHeight) {
    await wqtBlockInfo.update({
      lastParsedBlock: parseEventsFromHeight
    });
  }

  await wqtController.collectAllUncollectedEvents(wqtBlockInfo.lastParsedBlock);

  console.log('Start wqt listener');

  wqtProvider.startListener();
}

init().catch(console.error);
