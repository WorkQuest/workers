import * as path from 'path';
import * as fs from 'fs';
import Web3 from 'web3';
import configBridge from './config/config.bridge';
import config from './config/config.common';
import { BridgeContract } from './src/BridgeContract';
import { BridgeEthListener, BridgeBscListener } from './src/BridgeListener';
import { BridgeProvider } from './src/BridgeProvider';
import { BridgeParserBlockInfo, BlockchainNetworks, initDatabase } from '@workquest/database-models/lib/models';
import { BridgeMessageBroker } from './src/BridgeBroker';

const abiFilePath = path.join(__dirname, '/abi/liquidityMiningAbi.json');
const abi: any[] = JSON.parse(fs.readFileSync(abiFilePath).toString()).abi;

const parseEthEventsFromHeight = configBridge.debug
  ? configBridge.rinkebyTestNetwork.parseEventsFromHeight
  : configBridge.ethereumMainNetwork.parseEventsFromHeight;
const contractEthAddress = configBridge.debug ? configBridge.rinkebyTestNetwork.contract : configBridge.ethereumMainNetwork.contract;
const urlEthProvider = configBridge.debug ? configBridge.rinkebyTestNetwork.webSocketProvider : configBridge.ethereumMainNetwork.webSocketProvider;

const parseBscEventsFromHeight = configBridge.debug
  ? configBridge.bscTestNetwork.parseEventsFromHeight
  : configBridge.bscMainNetwork.parseEventsFromHeight;
const contractBscAddress = configBridge.debug ? configBridge.bscTestNetwork.contract : configBridge.bscMainNetwork.contract;
const urlBscProvider = configBridge.debug ? configBridge.bscTestNetwork.webSocketProvider : configBridge.bscMainNetwork.webSocketProvider;

export async function init() {
  console.log('Start bridge'); // TODO add pino

  await initDatabase(config.database.link, false, false);
  BridgeMessageBroker.initMessageBroker();

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

  const web3Bsc = new Web3(
    new Web3.providers.WebsocketProvider(urlBscProvider, {
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

  const [ethBridgeInfo] = await BridgeParserBlockInfo.findOrCreate({
    where: { network: BlockchainNetworks.ethMainNetwork },
    defaults: {
      network: BlockchainNetworks.ethMainNetwork,
      lastParsedBlock: parseEthEventsFromHeight,
    },
  });
  const [bcsBridgeInfo] = await BridgeParserBlockInfo.findOrCreate({
    where: { network: BlockchainNetworks.bscMainNetwork },
    defaults: {
      network: BlockchainNetworks.bscMainNetwork,
      lastParsedBlock: parseBscEventsFromHeight,
    },
  });

  if (ethBridgeInfo.lastParsedBlock < parseEthEventsFromHeight) {
    ethBridgeInfo.lastParsedBlock = parseEthEventsFromHeight;

    await ethBridgeInfo.save();
  }
  if (bcsBridgeInfo.lastParsedBlock < parseBscEventsFromHeight) {
    bcsBridgeInfo.lastParsedBlock = parseBscEventsFromHeight;

    await bcsBridgeInfo.save();
  }

  const bridgeEthProvider = new BridgeProvider(web3Eth, 'eth', ethBridgeInfo.lastParsedBlock);
  const bridgeBscProvider = new BridgeProvider(web3Bsc, 'bsc', bcsBridgeInfo.lastParsedBlock);

  const bridgeEthContract = new BridgeContract(bridgeEthProvider, contractEthAddress, abi);
  const bridgeBscContract = new BridgeContract(bridgeBscProvider, contractBscAddress, abi);

  const bridgeEthListener = new BridgeEthListener(bridgeEthContract, ethBridgeInfo);
  const bridgeBscListener = new BridgeBscListener(bridgeBscContract, bcsBridgeInfo);

  await Promise.all([bridgeEthListener.preParseSwaps(), bridgeBscListener.preParseSwaps()]);

  await Promise.all([bridgeEthListener.start(), bridgeBscListener.start()]);
}

init().catch(console.error);
