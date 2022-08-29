import Web3 from "web3";
import {Log} from "@ethersproject/abstract-provider/src.ts/index";
import {IIndexedKeysListRepository} from "./repository.interfaces";
import {BlockchainRepositoryWithCaching} from "./BlockchainRepositoryWithCaching";
import {BlockchainRepositoryOptions} from "./repository.types";

export class BlockchainRepositoryWithCachingAddresses extends BlockchainRepositoryWithCaching {
  constructor(
    protected readonly web3: Web3,
    protected readonly trackedContractAddresses: string[],
    protected readonly options: BlockchainRepositoryOptions,
    protected readonly logsRepository: IIndexedKeysListRepository<Log>,
  ) {
    super(web3, options, logsRepository);
  }

  protected async getPastLogsFromNode(payload: { addresses?: string[], fromBlockNumber: number, toBlockNumber: number }): Promise<Log[]> {
    return this.filterLogsByAddresses(
      await super.getPastLogsFromNode(payload),
      this.trackedContractAddresses,
    );
  }
}