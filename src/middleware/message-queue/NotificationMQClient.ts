import amqp from 'amqplib';
import {INotificationClient, NotifyPayload} from "../types";

export class NotificationMQClient implements INotificationClient {
  protected channel;
  protected connection;

  private readonly callbacks = { 'error': [], 'close': [] };

  constructor(
    protected readonly link: string,
    protected readonly queueName: string,
  ) {
  }

  public async init(): Promise<this> {
    this.connection = await amqp.connect(this.link, 'heartbeat=60');

    this.connection.on('error', this.onError.bind(this));
    this.connection.on('close', this.onClose.bind(this));

    this.channel = await this.connection.createChannel();

    return this;
  }

  private async sendToQueue(payload: object) {
    const payloadBuffer = Buffer.from(JSON.stringify(payload));

    await this.channel.sendToQueue(this.queueName, payloadBuffer);
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
    await this.callBackSubscribers('error', error);
  }

  public on(type, callback): this {
    if (type === 'close') {
      this.callbacks[type].push(callback);
    } else if (type === 'error') {
      this.callbacks[type].push(callback);
    }

    return this;
  }

  public async notify(payload: NotifyPayload) {
    await this.sendToQueue(payload);
  }
}
