import Web3 from 'web3';
import { Sign } from 'web3-core';
import { Contract } from 'web3-eth-contract';
import configBridge from '../config/config.bridge';

export class BridgeProvider {
  private readonly _web3: Web3;
  private readonly _network: 'eth' | 'bsc';

  private _lastTrackedBlock: number;

  get network() {
    return this._network;
  }

  get lastTrackedBlock() {
    return this._lastTrackedBlock;
  }

  set lastTrackedBlock(value) {
    this._lastTrackedBlock = value;
  }

  constructor(web3: Web3, network: 'eth' | 'bsc', fromBlock: number) {
    this._lastTrackedBlock = fromBlock;
    this._network = network;
    this._web3 = web3;
  }

  public async getBlockNumber(): Promise<number> {
    return this._web3.eth.getBlockNumber();
  }

  public async sing(fields: any[]): Promise<Sign> {
    return this._web3.eth.accounts.sign(Web3.utils.soliditySha3(...fields), configBridge.privateKey);
  }

  public makeContract(abi: any[], address: string): Contract {
    // @ts-ignore
    return new this._web3.eth.Contract(abi, address);
  }
}
