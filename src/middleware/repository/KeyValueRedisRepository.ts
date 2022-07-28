import {createClient} from "redis";
import {IKeyValueRepository} from "./repository.interfaces";

export abstract class KeyValueRedisRepository<TPayload> implements IKeyValueRepository<TPayload> {
  protected redisClient;
  private readonly callbacks = { 'error': [], 'close': [] };

  protected constructor(
    protected readonly redisClientOptions: { number: number, url: string },
  ) {
  }

  public async init(): Promise<this> {
    this.redisClient = createClient(this.redisClientOptions);

    await this.redisClient.on('error', this.onError.bind(this));
    await this.redisClient.on('close', this.onClose.bind(this));

    await this.redisClient.connect();

    return this;
  }

  public abstract getKeys(): Promise<string[]>;
  public abstract remove(key: string): Promise<void>;
  public abstract get(key: string): Promise<TPayload | null>;
  public abstract set(key: string, payload: TPayload): Promise<void>;

  public on(type, callback): this {
    if (type === 'close') {
      this.callbacks[type].push(callback);
    } else if (type === 'error') {
      this.callbacks[type].push(callback);
    }

    return this;
  }

  protected async onClose() {
    await this.callBackSubscribers('close');
  }

  protected async onError(error) {
    await this.callBackSubscribers('error', error);
  }

  private async callBackSubscribers(event: 'error' | 'close', ...args: any[]) {
    await Promise.all(
      this.callbacks[event].map(async (callBack) => {
        return callBack(...args);
      }),
    );
  }
}
