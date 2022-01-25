import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';

export class ProposalProvider {
  private readonly _web3: Web3;

  private _lastTrackedBlock: number;

  get lastTrackedBlock() {
    return this._lastTrackedBlock;
  }

  set lastTrackedBlock(value) {
    this._lastTrackedBlock = value;
  }

  constructor(web3: Web3, fromBlock: number) {
    this._lastTrackedBlock = fromBlock;
    this._web3 = web3;
  }

  public async getBlockNumber(): Promise<number> {
    return this._web3.eth.getBlockNumber();
  }

  public makeContract(abi: any[], address: string): Contract {
    // @ts-ignore
    return new this._web3.eth.Contract(abi, address);
  }
}
