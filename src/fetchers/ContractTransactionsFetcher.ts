import Web3 from "web3";
import { Transaction } from 'web3-eth';
import { SingleContractChildWorker, FactoryContractsChildWorker } from './types';

export class ContractTransactionsFetcher {
  constructor(
    public readonly web3Provider: Web3,
  ) {}

  private _fetchedUpToBlockNumber;

  private singleContractChildWorkers: SingleContractChildWorker[] = [];
  private factoryContractsChildWorkers: FactoryContractsChildWorker[] = [];

  private get fetchedUpToBlockNumber() {
    return this._fetchedUpToBlockNumber;
  }

  private set fetchedUpToBlockNumber(blockNumber) {
    this._fetchedUpToBlockNumber = blockNumber;
  }

  private viewingTxsTracedContracts(txs: Transaction[]) {
    const tracedTxs = txs
      .filter(tx => this.singleContractChildWorkers
          .findIndex( worker => tx.to && worker.address.toLowerCase() === tx.to.toLowerCase()) !== -1
        );

    if (tracedTxs.length === 0) {
      return;
    }

    for (const tx of tracedTxs) {
      const worker = this.singleContractChildWorkers
        .find(chW => tx.to.toLowerCase() === chW.address.toLowerCase())

      if (!worker) {
        continue;
      }

      worker.childProcess.send(JSON.stringify({
        message: 'onEvents',
        toBlock: tx.blockNumber,
        fromBlock: this.fetchedUpToBlockNumber,
      }));
    }
  }

  private async viewingTxsTracedContractsInCache(txs: Transaction[]) {
    const tracedTxs = txs
      .filter(tx => tx.to && this.factoryContractsChildWorkers
        .findIndex(async worker => await worker.cacheProvider.get(tx.to.toLowerCase()))
      );

    for (const tx of tracedTxs) {
      const worker = this.factoryContractsChildWorkers
        .find(async worker => await worker.cacheProvider.get(tx.to.toLowerCase()))

      if (!worker) {
        continue;
      }

      worker.childProcess.send(JSON.stringify({
        message: 'onEvents',
        toBlock: tx.blockNumber,
        fromBlock: this.fetchedUpToBlockNumber,
      }));
    }
  }

  protected async runTaskFetcher() {
    const currentBlockNumber = await this.web3Provider.eth.getBlockNumber();
    const rangeBlock = { fromBlock: this.fetchedUpToBlockNumber, toBlock: currentBlockNumber }

    if (rangeBlock.toBlock === rangeBlock.fromBlock) {
      return;
    }

    console.log(rangeBlock);

    const blocks = await Promise.all(
      [...Array(rangeBlock.toBlock - rangeBlock.fromBlock).keys()]
        .map(i => i + rangeBlock.fromBlock + 1)
        .map(async bn => this.web3Provider.eth.getBlock(bn, true))
    );

    console.log(rangeBlock);
    console.log(blocks.length);

    const txs = blocks
      .map(block => block.transactions)
      .reduce((prev, current) => [...prev, ...current]);

    if (txs.length !== 0) {
      this.viewingTxsTracedContracts(txs);
      await this.viewingTxsTracedContractsInCache(txs);
    }

    this.fetchedUpToBlockNumber = currentBlockNumber;
  }

  public addSingleContractWorker(worker: SingleContractChildWorker): this {
    this.singleContractChildWorkers.push(worker);

    return this;
  }

  public addFactoryContractsWorker(worker: FactoryContractsChildWorker): this {
    this.factoryContractsChildWorkers.push(worker);

    return this;
  }

  public async startFetcher() {
    this.fetchedUpToBlockNumber = await this.web3Provider.eth.getBlockNumber();

    setInterval(async () => {
      await this.runTaskFetcher();
    }, 15000);
  }
}


