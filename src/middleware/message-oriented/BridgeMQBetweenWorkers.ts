import EventEmitter from "events";
import amqp, {Channel, Connection} from 'amqplib';
import {IBridgeBetweenWorkers} from "./message-queue.interfaces";
import {BlockchainNetworks} from "@workquest/database-models/lib/models";

export class BridgeMQBetweenWorkers implements IBridgeBetweenWorkers {
  protected channel: Channel;
  private connection: Connection;

  private readonly eventEmitter: EventEmitter;

  protected readonly queueWorkerName: string;
  protected readonly exchangeName: 'BridgeWorkersExchange';

  constructor(
    private readonly mqLink: string,
    public readonly workerName,
    public readonly network: BlockchainNetworks,
  ) {
    this.eventEmitter = new EventEmitter();
    this.queueWorkerName = `BridgeWorkers.${workerName}.${network}`;
  }

  public async init(): Promise<this> {
    this.connection = await amqp.connect(this.mqLink, 'heartbeat=60');

    this.connection.on('error', this.onErrorHandler.bind(this));
    this.connection.on('close', this.onClose.bind(this));

    this.channel = await this.connection.createChannel();

    await this.channel.assertExchange(this.exchangeName, 'direct', {
      durable: true,
    });

    await this.channel.assertQueue(this.queueWorkerName, {
      durable: true,
      exclusive: false,
    });

    await this.channel.bindQueue(this.queueWorkerName, this.exchangeName, this.queueWorkerName);

    await this.channel.consume(
      this.queueWorkerName,
      this.onMessageHandler.bind(this),
    );

    return this;
  }

  protected onClose() {
    this.eventEmitter.emit('close');
  }

  protected async onErrorHandler(error) {
    this.eventEmitter.emit('error', error);
  }

  protected async onMessageHandler(message) {
    try {
      const msg = JSON.parse(message.content);

      if ('type' in msg && 'payload' in msg) {
        await this.onWorkerMessageHandler(msg.type, msg.payload);
        this.channel.ack(message);
      }
    } catch (error) {
      await this.onErrorHandler(error);
    }
  }

  protected onWorkerMessageHandler(type: string, payload: object) {
    this.eventEmitter.emit('worker-message', type, payload);
  }

  public on(type, callback) {
    if (type === 'close') {
      this.eventEmitter.addListener('close', callback);
    } else if (type === 'error') {
      this.eventEmitter.addListener('error', callback);
    } else if (type === 'worker-message') {
      this.eventEmitter.addListener('worker-message', callback);
    }

    return this;
  }

  protected publishToExchange(routingKey: string, payload: object) {
    const payloadBuffer = Buffer.from(JSON.stringify(payload));

    this.channel.publish(this.exchangeName, routingKey, payloadBuffer);
  }

  public async sendMessage(whose: { workerName: string, network: BlockchainNetworks }, type: string, payload: object) {
    await this.publishToExchange(`BridgeWorkers.${whose.workerName}.${whose.network}`, { type, payload });
  }
}
