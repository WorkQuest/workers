import {EventData} from "web3-eth-contract";

export type ReceivedEvents = {
  error?: any,
  events: EventData[],
  lastBlockNumber: number,
}

export type defaultConfigValues = {
  contractAddress: string,
  linkRpcProvider: string,
  parseEventsFromHeight: string,
}


