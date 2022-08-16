import Web3 from "web3";
import EventEmitter from "events";
import {ILogsFetcherWorker} from "./blockchain.interfaces";
import {Log} from "@ethersproject/abstract-provider/src.ts/index";

export class LogsFetcher implements ILogsFetcherWorker {
  private fetchedUpToBlockNumber: number;
  private readonly eventEmitter: EventEmitter;

  constructor(
    protected readonly web3: Web3,
  ) {
    this.eventEmitter = new EventEmitter();
  }

  private updateFetchedUpToBlockNumber(blockNumber: number) {
    this.fetchedUpToBlockNumber = blockNumber;
  }

  protected onLogHandler(logs: Log[]) {
    if (logs.length !== 0) {
      this.eventEmitter.emit('logs', logs);
    }
  }

  protected async runTaskFetcher() {
    const toBlock = await this.web3.eth.getBlockNumber();

    if (toBlock >= this.fetchedUpToBlockNumber) {
      return;
    }

    const logs = await this.web3.eth.getPastLogs({ toBlock });

    this.updateFetchedUpToBlockNumber(toBlock);
    this.onLogHandler(logs as Log[]);
  }

  public on(type, callback) {
    if (type === 'logs') {
      this.eventEmitter.addListener('logs', callback);
    }
  }

  public async startFetcher() {
    const lastBlockNumber = await this.web3.eth.getBlockNumber();

    this.updateFetchedUpToBlockNumber(lastBlockNumber);
    setInterval(async () => { await this.runTaskFetcher() }, 15000);
  }
}
