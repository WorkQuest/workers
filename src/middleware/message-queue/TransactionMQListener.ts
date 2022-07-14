import amqp from 'amqplib';
import {Transaction} from "web3-eth";
import {ITransactionListener} from "../types";

const asyncFilter = async (arr, predicate) => {
  const results = await Promise.all(arr.map(predicate));

  return arr.filter((_v, index) => results[index]);
}

export class TransactionMQListener implements ITransactionListener {
  protected channel;
  protected connection;

  private txFilter: (tx: Transaction) => boolean;

  private readonly callbacks = { 'transactions': [], 'error': [], 'close': [] };

  constructor(
    protected readonly link: string,
    protected readonly queueName: string,
  ) {
  }

  public async init() {
    this.connection = await amqp.connect(this.link, 'heartbeat=60');

    this.connection.on('error', this.onError.bind(this));
    this.connection.on('close', this.onClose.bind(this));

    this.channel = await this.connection.createChannel();

    await this.channel.consume(
      this.queueName,
      this.onMessage.bind(this),
    );
  }

  public on(type, callback): this {
    if (type === 'close') {
      this.callbacks[type].push(callback);
    } else if (type === 'error') {
      this.callbacks[type].push(callback);
    } else if (type === 'transactions') {
      this.callbacks[type].push(callback);
    }

    return this;
  }

  private async callBackSubscribers(event: 'error' | 'close' | 'transactions', ...args: any[]) {
    await Promise.all(
      this.callbacks[event].map(async (callBack) => {
        return callBack(...args);
      }),
    );
  }

  protected async onMessage(message) {
    try {
      const txs = JSON.parse(message.content);

      await Promise.all([
        this.onTransaction(txs),
        this.channel.ack(message),
      ]);
    } catch (error) {
      await this.onError(error);
    }
  }

  protected async onClose() {
    await this.callBackSubscribers('close');
  }

  protected async onError(error) {
    await this.callBackSubscribers('error', error);
  }

  protected async onTransaction(transactions: Transaction[]) {
    if (!this.txFilter) {
      await this.callBackSubscribers('transactions', transactions);
    }

    await this.callBackSubscribers('transactions',
      await asyncFilter(transactions, this.txFilter),
    );
  }

  public setFiltering(filter: (tx: Transaction) => boolean) {
    this.txFilter = filter;
  }
}
