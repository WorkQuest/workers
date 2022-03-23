import fs from "fs";
import path from "path";
import Web3 from "web3";
import {createClient} from "redis";
import {Clients} from "./src/providers/types";
import configQuest from "./config/config.quest";
import configDatabase from "./config/config.database";
import {initDatabase, QuestBlockInfo, BlockchainNetworks} from "@workquest/database-models/lib/models";
import {QuestCacheProvider} from "./src/providers/QuestCacheProvider";
import {WebsocketClient as TendermintWebsocketClient} from "@cosmjs/tendermint-rpc/build/rpcclients/websocketclient";
import {QuestProvider} from "./src/providers/QuestProvider";
import {QuestController} from "./src/controllers/QuestController";

const abiFilePath = path.join(__dirname, '../../src/quest/abi/WorkQuest.json');
const abi: any[] = JSON.parse(fs.readFileSync(abiFilePath).toString()).abi;

export async function init() {
  await initDatabase(configDatabase.dbLink, false, true);

  const redisConfig = configDatabase.redis.defaultConfigNetwork();
  const { linkRpcProvider, contractAddress, parseEventsFromHeight, linkTendermintProvider } = configQuest.defaultConfigNetwork();

  const redisClient = createClient(redisConfig);

  await redisClient.on('error', (err) => { throw err });
  await redisClient.connect();

  const tendermintWsClient = new TendermintWebsocketClient(linkTendermintProvider, error => {
    throw error;
  });

  const web3 = new Web3(new Web3.providers.HttpProvider(linkRpcProvider));
  const questContract = new web3.eth.Contract(abi, contractAddress);
  // @ts-ignore
  const questCacheProvider = new QuestCacheProvider(redisClient);
  const clients: Clients = { web3, tendermintWsClient, questCacheProvider }

  const [questBlockInfo] = await QuestBlockInfo.findOrCreate({
    where: { network: configQuest.network },
    defaults: {
      network: configQuest.network,
      lastParsedBlock: parseEventsFromHeight,
    },
  });

  if (questBlockInfo.lastParsedBlock < parseEventsFromHeight) {
    questBlockInfo.lastParsedBlock = parseEventsFromHeight;

    await questBlockInfo.save();
  }

  const questProvider = new QuestProvider(clients, questContract);
  const questController = new QuestController(clients, questProvider, configQuest.network as BlockchainNetworks);

  await questController.collectAllUncollectedEvents(questBlockInfo.lastParsedBlock);

  questProvider.startListener();
}

init().catch(e => { throw e });
