import Web3 from "web3";
import configFetcher from "./config/config.fetcher";
import { Logger } from "./logger/pino";

async function init() {
  const {
    linkRpcProvider,
    linkMessageBroker
  } = configFetcher.defaultConfigNetwork();


}

init().catch(e => {
  console.error(e);
  process.exit(-1);
});
