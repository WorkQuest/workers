import {EventData} from "web3-eth-contract";

export type ReceivedEvents = {
  error?: any,
  events: EventData[],
  lastBlockNumber: number,
}

/** Settings for each Contracts Providers */
export type ContractRpcProviderSettings = {
  blockAssembler: { steps: number },
}

export type ContractWsProviderSettings = {

}

export type ContractRouterProviderSettings = {

}


