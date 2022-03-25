import Web3 from "web3";
import { Contract } from 'web3-eth-contract';

export interface ChildWorkerPayload {
  childProcess: any;
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

    const blocks = await Promise.all(
      [...Array(rangeBlock.toBlock - rangeBlock.fromBlock).keys()]
        .map(i => i + rangeBlock.fromBlock)
        .map(async bn => this.web3Provider.eth.getBlock(bn, true))
    );

    const txs = blocks
      .map(block => block.transactions)
      .reduce((prev, current) => [...prev, ...current])
      .filter(tx => this.childWorkers
        .findIndex(chW => chW.address.toLowerCase() === tx.to.toLowerCase()) !== -1
      );

    if (txs.length === 0) {
      return;
    }

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

    this.fetchedUpToBlockNumber = currentBlockNumber + 1;
  }

  public addContractAddresses(payload: ChildWorkerPayload): this {
    this.childWorkers.push(payload);

    return this;
  }

  public async startFetcher() {
    this.fetchedUpToBlockNumber = await this.web3Provider.eth.getBlockNumber();

    setInterval(async () => {
      await this.runTaskFetcher();
    }, 3000);
  }

}


