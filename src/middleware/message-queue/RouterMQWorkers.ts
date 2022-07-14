import amqp from 'amqplib';
import {Transaction} from "web3-eth";
import {IRouterWorkers} from "../types";

export class RouterMQWorkers implements IRouterWorkers {
  protected channel;
  protected connection;

  private readonly callbacks = { 'error': [], 'close': [] };

  constructor(
    protected readonly link: string,
  ) {
  }

  public async init() {
    this.connection = await amqp.connect(this.link, 'heartbeat=60');

    this.connection.on('error', this.onError.bind(this));
    this.connection.on('close', this.onClose.bind(this));

    this.channel = await this.connection.createChannel();

    await this.channel.assertExchange('transactions');
  }

  private async sendToQueue(payload: object) {
    const payloadBuffer = Buffer.from(JSON.stringify(payload));

    await this.channel.publish('transactions', '', payloadBuffer, {
      persistent: true
    });
  }

  private async callBackSubscribers(event: 'error' | 'close', ...args: any[]) {
    await Promise.all(
      this.callbacks[event].map(async (callBack) => {
        return callBack(...args);
      }),
    );
  }

  protected async onClose() {
    await this.callBackSubscribers('close');
  }

  protected async onError(error) {
    await this.callBackSubscribers('close', error);
  }

  public on(type, callback) {
    if (type === 'close') {
      this.callbacks[type].push(callback);
    } else if (type === 'error') {
      this.callbacks[type].push(callback);
    }

    return this;
  }

  public async notifyAboutTransactions(...transactions: Transaction[]) {
    await this.sendToQueue({ transactions });
  }
}
