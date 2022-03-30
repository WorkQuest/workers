import {ChildProcess} from "child_process";
import {Contract} from "web3-eth-contract";
import {IContractCacheProvider} from '../../types'

export interface ChildWorker {
  readonly name: string;
  readonly childProcess: ChildProcess;
}

export interface SingleContractChildWorker extends ChildWorker {
  readonly address: string;
  readonly contract: Contract;
}

export interface FactoryContractsChildWorker extends ChildWorker {
  readonly cacheProvider: IContractCacheProvider<any>;
}
