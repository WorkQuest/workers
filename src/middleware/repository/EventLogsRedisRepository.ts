import EventEmitter from "events";
import {createClient} from "redis";
import {Log} from "@ethersproject/abstract-provider/src.ts/index";
import {IIndexedKeysListRepository} from "./repository.interfaces";
import {BlockchainNetworks} from "@workquest/database-models/lib/models";

export class EventLogsRedisRepository implements IIndexedKeysListRepository<Log> {
  protected redisClient;
  private readonly eventEmitter: EventEmitter;

  protected get indexName()       { return this.network + '.Logs.Range' }
  protected get prefixListName()  { return this.network + ':logs:'      }
  protected get allKeysQuery()    { return this.prefixListName + "*"    }

  constructor(
    protected readonly network: BlockchainNetworks,
    protected readonly redisClientOptions: { number: number, url: string },
  ) {
    this.eventEmitter = new EventEmitter();
  }

  public async init(): Promise<this> {
    this.redisClient = createClient(this.redisClientOptions);

    await this.redisClient.on('error', this.onError.bind(this));
    await this.redisClient.on('close', this.onClose.bind(this));

    await this.redisClient.connect();

    return this;
  }

  public on(type, callback): this {
    if (type === 'close') {
      this.eventEmitter.addListener('close', callback);
    } else if (type === 'error') {
      this.eventEmitter.addListener('close', callback);
    }

    return this;
  }

  protected onClose() {
    this.eventEmitter.emit('close');
  }

  protected onError(error) {
    this.eventEmitter.emit('error', error);
  }

  private blockNumberToKeyWithPrefix(blockNumber: string) {
    return this.prefixListName + blockNumber;
  }

  private keyWithPrefixToBlockNumber(key: string) {
    return key.replace(this.prefixListName, '');
  }


  /** Rem */
  private async removeListByKeyWithPrefix(keyWithPrefix: string): Promise<void> {
    await Promise.all([
      this.redisClient.del(keyWithPrefix),
      this.redisClient.zRem(this.indexName, keyWithPrefix),
    ]);
  }

  public async removeList(blockNumber: string): Promise<void> {
    await this.removeListByKeyWithPrefix(
      this.blockNumberToKeyWithPrefix(blockNumber),
    );
  }

  public async removeListRangeByScore(from: number, to: number): Promise<void> {
    const keys = await this.getListKeysWithPrefixRangeByScore(from, to);

    for (const key of keys) {
      await this.removeListByKeyWithPrefix(key);
    }
  }

  public async removeListRangeByPosition(start: number, stop: number): Promise<void> {
    const keys = await this.getListKeysWithPrefixRangeByPosition(start, stop);

    for (const key of keys) {
      await this.removeListByKeyWithPrefix(key);
    }
  }


  /** Get Keys */
  private async getListKeysWithPrefixRangeByScore(from: number, to: number): Promise<string[]> {
    return await this.redisClient.zRangeByScore(
      this.indexName,
      from, to,
    );
  }

  private async getListKeysWithPrefixRangeByPosition(start: number = 0, stop: number = -1): Promise<string[]> {
    return await this.redisClient.zRange(
      this.indexName,
      start, stop,
    );
  }

  public async getListKeys(): Promise<string[]> {
    return (await this.getListKeysWithPrefixRangeByPosition())
      .map(key => this.keyWithPrefixToBlockNumber(key))
  }

  public async getListKeysCount(): Promise<number> {
    return await this.redisClient.zCount(
      this.indexName,
      '-inf', '+inf',
    );
  }

  public async getListKeysRangeByScore(from: number, to: number): Promise<string[]> {
    return (await this.getListKeysWithPrefixRangeByScore(from, to))
      .map(key => this.keyWithPrefixToBlockNumber(key))
  }

  public async getListKeysRangeByPosition(start: number, stop: number): Promise<string[]> {
    return (await this.getListKeysWithPrefixRangeByPosition(start, stop))
      .map(key => this.keyWithPrefixToBlockNumber(key))
  }


  /** Get Values */
  private async getListValuesByKeyWithPrefix(key: string, from: number, to: number): Promise<Log[]> {
    return (await this.redisClient.lRange(
      key,
      from, to,
    )).map(value => JSON.parse(value))
  }

  private async getValuesOfMergedListsByKeysWithPrefixRangeByScore(from: number, to: number): Promise<Log[]> {
    return await this.redisClient.mGet(
      await this.getListKeysWithPrefixRangeByScore(from, to)
    )
      .filter((logs: string[] | null) => logs)
      .flat()
      .map(log => JSON.parse(log))
  }

  private async getValuesOfMergedListsByKeysWithPrefix(): Promise<Log[]> {
    const keys = await this.getListKeysWithPrefixRangeByPosition();

    return (await Promise.all(
      keys.map(
        async (key) => this.getListValuesByKeyWithPrefix(key, 0, -1)
      )
    ))
      .filter((logs: Log[] | null) => logs)
      .flat()
  }

  public async getListValues(blockNumber: string, from: number = 0, to: number = -1): Promise<Log[]> {
    return await this.getListValuesByKeyWithPrefix(
      this.blockNumberToKeyWithPrefix(blockNumber),
      from, to,
    );
  }

  public async getValuesOfMergedLists(): Promise<Log[]> {
    return await this.getValuesOfMergedListsByKeysWithPrefix();
  }

  public async getValuesOfMergedListsRangeByScore(from: number, to: number): Promise<Log[]> {
    return await this.getValuesOfMergedListsByKeysWithPrefixRangeByScore(from, to);
  }


  /** Push */
  public async push(blockNumber: string, ...log: Log[]): Promise<number> {
    console.log("Push " + this.network + " blockNumber: " + blockNumber, + "  zindex " + this.blockNumberToKeyWithPrefix(blockNumber));

    if (log.length === 0 ) {
      await this.redisClient.zAdd(this.indexName, { value: this.blockNumberToKeyWithPrefix(blockNumber), score: parseInt(blockNumber) });

      return 0;
    }

    const encodedLogs = log
      .map(log => JSON.stringify(log))

    const [logsLen, ] = await Promise.all([
      this.redisClient.lPush(this.blockNumberToKeyWithPrefix(blockNumber), encodedLogs),
      this.redisClient.zAdd(this.indexName, { value: this.blockNumberToKeyWithPrefix(blockNumber), score: parseInt(blockNumber) }),
    ]);

    return logsLen;
  }
}
