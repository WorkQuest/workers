import amqp from 'amqplib';
import {IBridgeBetweenWorkers} from "../types";

export class BridgeMQBetweenWorkers implements IBridgeBetweenWorkers {
  protected channel;
  protected connection;

  private readonly queueName = 'communication';
  private readonly callbacks = { 'error': [], 'close': [], 'worker-message': [] };

  constructor(
    protected readonly link: string,
  ) {
  }

  public async init() {
    this.connection = await amqp.connect(this.link, 'heartbeat=60');

    this.connection.on('error', this.onError.bind(this));
    this.connection.on('close', this.onClose.bind(this));

    this.channel = await this.connection.createChannel();

    await this.channel.assertQueue(this.queueName);

    await this.channel.consume(
      this.queueName,
      this.onMessage.bind(this),
    );
  }

  private async callBackSubscribers(event: 'error' | 'close' | 'worker-message', ...args: any[]) {
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

  protected async onMessage(message) {
    try {
      const msg = JSON.parse(message.content);

      if ('type' in msg && 'payload' in msg) {
        await Promise.all([
          this.onWorkerMessage(msg.type, msg.payload),
          this.channel.ack(message),
        ]);
      }
    } catch (error) {
      await this.onError(error);
    }
  }

  protected async onWorkerMessage(type: string, payload: object) {
    await this.callBackSubscribers('worker-message', type, payload);
  }

  public on(type, callback) {
    if (type === 'close') {
      this.callbacks[type].push(callback);
    } else if (type === 'error') {
      this.callbacks[type].push(callback);
    } else if (type === 'worker-message') {
      this.callbacks[type].push(callback);
    }

    return this;
  }

  private async sendToQueue(payload: object) {
    const payloadBuffer = Buffer.from(JSON.stringify(payload));

    await this.channel.sendToQueue(this.queueName, payloadBuffer);
  }

  public async sendMessage(type: string, payload: object) {
    await this.sendToQueue({ type, payload });
  }
}
