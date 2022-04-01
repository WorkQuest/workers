import { TransactionsFetcher } from "./src/TransactionsFetcher";
import { BrokerRouter } from "../brokers/src/BrokerRouter";
import configFetcher from "./config/config.fetcher";
import Web3 from "web3";

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

});
