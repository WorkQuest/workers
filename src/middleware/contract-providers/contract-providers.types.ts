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

export type ContractRpcProviderOptions = {
  /**
   * Get logs by step range.
   * (from, from + stepsRange)
   */
  stepsRange: number,
}

