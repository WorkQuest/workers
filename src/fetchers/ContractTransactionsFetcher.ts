import Web3 from "web3";
import { Contract } from 'web3-eth-contract';
import {ChildProcess} from "child_process";

export interface ChildWorkerPayload {
  childProcess: ChildProcess;
  name: string;
  address: string;
  contract: Contract;
}

export class ContractTransactionsFetcher {
  constructor(
    public readonly web3Provider: Web3,
  ) {}

  private _fetchedUpToBlockNumber;

  private childWorkers: ChildWorkerPayload[] = []

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
      .reduce((prev, current) => [...prev, ...current])
      .filter(tx => this.childWorkers
        .findIndex(chW => chW.address.toLowerCase() === tx.to.toLowerCase()) !== -1
      );

    if (txs.length !== 0) {
      for (const chW of this.childWorkers) {
        const contractTx = txs
          .find(tx => tx.to.toLowerCase() === chW.address.toLowerCase())

        if (!contractTx) {
          continue;
        }

        const eventsData = await chW.contract.getPastEvents('allEvents', rangeBlock);

        if (eventsData.length !== 0) {
          console.log(chW.name + ': on eventsData length = ', eventsData.length);

          chW.childProcess.send(JSON.stringify({
            message: 'onEvents',
            toBlock: currentBlockNumber,
            fromBlock: this.fetchedUpToBlockNumber,
          }));
        }
      }
    }

    this.fetchedUpToBlockNumber = currentBlockNumber;
  }

  public addChildFetcher(payload: ChildWorkerPayload): this {
    this.childWorkers.push(payload);

    return this;
  }

  public removeChildFetcher(name: string): ChildWorkerPayload | null {
    const index = this.childWorkers.findIndex((cW) => cW.name === name);

    if (index === -1) {
      return;
    }

    const returnValue = this.childWorkers[index];

    this.childWorkers.splice(index, 1);

    return returnValue;
  }

  public async startFetcher() {
    this.fetchedUpToBlockNumber = await this.web3Provider.eth.getBlockNumber();

    setInterval(async () => {
      await this.runTaskFetcher();
    }, 15000);
  }
}


