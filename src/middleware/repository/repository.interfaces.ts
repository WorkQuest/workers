/**
 * Key value repository is intended to store useful data
 *  for frequent access. For example, contracts that are
 *  created by means of factories
 */
import {Log} from "@ethersproject/abstract-provider/src.ts/index";

export interface IKeyValueRepository<TPayload> {
  on(type: 'close', callback: () => void);      // TODO only async channel
  on(type: 'error', callback: (error) => void); // TODO only async channel

  getKeys(): Promise<string[]>;
  get(key: string): Promise<TPayload | null>;

  remove(key: string): Promise<void>;
  set(key: string, payload: TPayload): Promise<void>;
}

/**
 *
 *
 */
export interface IKeyListRepository<TPayload> {
  on(type: 'close', callback: () => void);      // TODO only async channel
  on(type: 'error', callback: (error) => void); // TODO only async channel

  removeList(key: string): Promise<void>;

  getListKeys(): Promise<string[]>;
  getListKeysCount(): Promise<number>;

  getValuesOfMergedLists(): Promise<TPayload[]>;
  getListValues(key: string, from: number, to: number): Promise<TPayload[]>;

  push(key: string, ...payload: TPayload[]): Promise<number>;
}

export interface IIndexedKeysListRepository<TPayload> extends IKeyListRepository<TPayload> {
  removeListRangeByScore(from: number, to: number): Promise<void>;
  removeListRangeByPosition(start: number, stop: number): Promise<void>;

  getListKeysRangeByScore(from: number, to: number): Promise<string[]>;
  getListKeysRangeByPosition(start: number, stop: number): Promise<string[]>;

  getValuesOfMergedListsRangeByScore(from: number, to: number): Promise<TPayload[]>;
}

export interface IBlockchainRepository {
  // TODO: Replenish as needed
  getBlockNumber(): Promise<number>;
  getPastLogs(payload: { addresses?: string[], fromBlockNumber: number, toBlockNumber: number }): Promise<Log[]>;
}
