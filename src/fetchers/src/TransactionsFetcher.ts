import Web3 from "web3";
import { Transaction } from 'web3-eth';
import { SingleContractChildWorker, FactoryContractsChildWorker } from './types';

export class TransactionsFetcher {
  constructor(
    public readonly web3Provider: Web3,
  ) {}

  private _fetchedUpToBlockNumber;

  private get fetchedUpToBlockNumber() {
    return this._fetchedUpToBlockNumber;
  }

  private set fetchedUpToBlockNumber(blockNumber) {
    this._fetchedUpToBlockNumber = blockNumber;
  }

  protected async runTaskFetcher() {
    const currentBlockNumber = await this.web3Provider.eth.getBlockNumber();
    const rangeBlock = { fromBlock: this.fetchedUpToBlockNumber, toBlock: currentBlockNumber }

    if (rangeBlock.toBlock === rangeBlock.fromBlock) {
      return;
    }

    const blocks = await Promise.all(
      [...Array(rangeBlock.toBlock - rangeBlock.fromBlock).keys()]
        .map(i => i + rangeBlock.fromBlock + 1)
        .map(async bn => this.web3Provider.eth.getBlock(bn, true))
    );

    const txs = blocks
      .map(block => block.transactions)
      .reduce((prev, current) => [...prev, ...current]);

    if (txs.length !== 0) {

    }

    this.fetchedUpToBlockNumber = currentBlockNumber;
  }

  public async startFetcher() {
    this.fetchedUpToBlockNumber = await this.web3Provider.eth.getBlockNumber();

    setInterval(async () => {
      await this.runTaskFetcher();
    }, 15000);
  }
}


