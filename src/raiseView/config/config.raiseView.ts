import {config} from "dotenv";

config({ path: __dirname +  '/../../../.env.raiseView'});

export default {
  logLevel: 'debug',
  network: process.env.BLOCKCHAIN_NETWORK,
  defaultConfigNetwork: (): { contractAddress: string, linkTendermintProvider: string, linkRpcProvider: string, parseEventsFromHeight: number } => {
    // @ts-ignore
    return this.default[this.default.network];
  },
}
