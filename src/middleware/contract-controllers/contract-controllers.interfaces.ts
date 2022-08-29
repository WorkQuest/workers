import {BlockchainNetworks} from "@workquest/database-models/lib/models";
import {IContractProvider} from "../contract-providers/contract-providers.interfaces";

export interface IController {
  readonly network: BlockchainNetworks;
  readonly contractProvider: IContractProvider;

  start(): Promise<void>;
  syncBlocks(): Promise<void>;
  getLastCollectedBlock(): Promise<number>;
}