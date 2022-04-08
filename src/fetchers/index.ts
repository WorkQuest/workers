import Web3 from "web3";
import configFetcher from "./config/config.fetcher";
import { BrokerRouter } from "../brokers/src/BrokerRouter";
import { TransactionsFetcher } from "./src/TransactionsFetcher";
import { Logger } from "./logger/pino";

async function init() {
  const {
    linkRpcProvider,
    linkMessageBroker
  } = configFetcher.defaultConfigNetwork();

  Logger.debug('Fetcher starts on "%s" network', configFetcher.network);
  Logger.debug('WorkQuest network: link Rpc provider "%s"', linkRpcProvider);

  const rpcProvider = new Web3.providers.HttpProvider(linkRpcProvider);
  const web3 = new Web3(rpcProvider);

  const router = new BrokerRouter(linkMessageBroker, 'transactions');
  await router.init();

  const fetcher = new TransactionsFetcher(web3, router);

  await fetcher.startFetcher();
}

init().catch(e => {
  console.error(e);
  process.exit(-1);
});
