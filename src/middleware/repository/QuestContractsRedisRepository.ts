import EventEmitter from "events";
import {createClient} from "redis";
import {QuestContractsPayload} from "./repository.types";
import {IKeyValueRepository} from "./repository.interfaces";
import {BlockchainNetworks} from "@workquest/database-models/lib/models";

export class QuestContractsRedisRepository implements IKeyValueRepository<QuestContractsPayload> {
  protected redisClient;
  private readonly eventEmitter: EventEmitter;

  protected get prefixListName() { return BlockchainNetworks.workQuestNetwork + ':Quest:Contract:' }

  constructor(
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

  private addressToKey(address): string {
    return this.prefixListName + address;
  }

  public async getKeys(): Promise<string[]> {
    return await this.redisClient.keys(this.prefixListName + "*");
  }

  public async remove(address: string): Promise<void> {
    await this.redisClient.del(
      this.addressToKey(address),
    );
  }

  public async get(address: string): Promise<QuestContractsPayload | null> {
    return await this.redisClient.get(
      this.addressToKey(address),
    );
  }

  public async set(address: string, payload: QuestContractsPayload): Promise<void> {
    await this.redisClient.set(
      this.addressToKey(address),
      JSON.stringify(payload),
    );
  }
}
