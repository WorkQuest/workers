import Web3 from "web3";
import { Contract } from 'web3-eth-contract';

export interface ChildWorkerPayload {
  childProcess: any;
  name: string;
  contract: Contract;
}

export class ContractTransactionsFetcher {
  constructor(
    public readonly web3Provider: Web3,
  ) {
  }

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

    for (const chW of this.childWorkers) {
      const eventsData = await chW.contract.getPastEvents('allEvents', {
        fromBlock: this.fetchedUpToBlockNumber, toBlock: currentBlockNumber,
      });

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


