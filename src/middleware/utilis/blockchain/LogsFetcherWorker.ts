import EventEmitter from "events";
import {ILogsFetcherWorker} from "./blockchain.interfaces";
import {Log} from "@ethersproject/abstract-provider/src.ts/index";
import {IBlockchainRepository} from "../../repository/repository.interfaces";

export class LogsFetcherWorker implements ILogsFetcherWorker {
  private fetchedUpToBlockNumber: number;
  private readonly eventEmitter: EventEmitter;

  constructor(
    protected readonly blockchainRepository: IBlockchainRepository,
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

  protected async collectPastLogs() {
    const toBlock = await this.blockchainRepository.getBlockNumber();

    if (toBlock <= this.fetchedUpToBlockNumber) {
      return;
    }

    const logs = await this.blockchainRepository.getPastLogs({
      fromBlockNumber: this.fetchedUpToBlockNumber,
      toBlockNumber: toBlock,
    });

    this.updateFetchedUpToBlockNumber(toBlock);
    this.onLogHandler(logs);
  }

  public on(type, callback) {
    if (type === 'logs') {
      this.eventEmitter.addListener('logs', callback);
    }
  }

  private runTaskFetcher() {
    setTimeout(async () => {
      await this.collectPastLogs();
      this.runTaskFetcher();
    }, 10000); // TODO add settings
  }

  public async startFetcher() {
    const lastBlockNumber = await this.blockchainRepository.getBlockNumber();

    this.updateFetchedUpToBlockNumber(lastBlockNumber);
    this.runTaskFetcher();
  }
}
