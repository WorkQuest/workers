import {ChildProcess} from "child_process";
import {Contract} from "web3-eth-contract";
import {IQuestCacheProvider} from "../quest/src/providers/types";

export interface ChildWorker {
  readonly childProcess: ChildProcess;
  readonly name: string;
}

export interface SingleContractChildWorker extends ChildWorker {
  readonly address: string;
  readonly contract: Contract;
}

export interface FactoryContractsChildWorker extends ChildWorker {
  readonly cacheProvider: IQuestCacheProvider; // TODO абрстрагировать и обобщить тип)
}
