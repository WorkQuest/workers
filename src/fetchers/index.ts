import Web3 from "web3";
import configFetcher from "./config/config.fetcher";
import { BrokerRouter } from "../brokers/src/BrokerRouter";
import { TransactionsFetcher } from "./src/TransactionsFetcher";

async function init() {
  const {
    linkRpcProvider,
    linkMessageBroker
  } = configFetcher.defaultConfigNetwork();

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
