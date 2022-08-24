import amqp from 'amqplib';
import EventEmitter from "events";
import {NotifyPayload} from "./message-queue.types";
import {INotificationSenderClient} from "./message-queue.interfaces";

export class NotificationMQClient implements INotificationSenderClient {
  protected channel;
  protected connection;

  private readonly eventEmitter: EventEmitter;

  constructor(
    protected readonly mqLink: string,
    private readonly queueName: string,
  ) {
    this.eventEmitter = new EventEmitter();
  }

  public async init(): Promise<this> {
    this.connection = await amqp.connect(this.mqLink, 'heartbeat=60');

    this.connection.on('error', this.onError.bind(this));
    this.connection.on('close', this.onClose.bind(this));

    this.channel = await this.connection.createChannel();

    return this;
  }

  private async sendToQueue(payload: object) {
    const payloadBuffer = Buffer.from(JSON.stringify(payload));

    await this.channel.sendToQueue(this.queueName, payloadBuffer);
  }


  protected onClose() {
    this.eventEmitter.emit('close');
  }

  protected async onError(error) {
    this.eventEmitter.emit('error', error);
  }


  public on(type, callback): this {
    if (type === 'close') {
      this.eventEmitter.addListener('close', callback);
    } else if (type === 'error') {
      this.eventEmitter.addListener('error', callback);
    }

    return this;
  }

  public async notify(payload: NotifyPayload) {
    await this.sendToQueue(payload);
  }
}
