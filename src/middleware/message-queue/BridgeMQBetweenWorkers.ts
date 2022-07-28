import EventEmitter from "events";
import amqp, {Channel, Connection} from 'amqplib';
import {IBridgeBetweenWorkers} from "./message-queue.interfaces";
import {BlockchainNetworks} from "@workquest/database-models/lib/models";

export class BridgeMQBetweenWorkers implements IBridgeBetweenWorkers {
  protected channel: Channel;
  private connection: Connection;
  private readonly queueName: string;

  private readonly eventEmitter: EventEmitter;

  constructor(
    private readonly mqLink: string,
    public readonly workerName,
    public readonly network: BlockchainNetworks,
  ) {
    this.eventEmitter = new EventEmitter();
    this.queueName = `BridgeWorkers.${workerName}.${network}`;
  }

  public async init(): Promise<this> {
    this.connection = await amqp.connect(this.mqLink, 'heartbeat=60');

    this.connection.on('error', this.onError.bind(this));
    this.connection.on('close', this.onClose.bind(this));

    this.channel = await this.connection.createChannel();

    const { exchange } = await this.channel.assertExchange('BridgeWorkers', 'topic', {

    });

    await this.channel.assertQueue(this.queueName, {
      durable: true,
      exclusive: false,
    });

    await this.channel.bindQueue(this.queueName, exchange, {

    })

    await this.channel.consume(
      this.queueName,
      this.onMessage.bind(this),
    );

    return this;
  }

  protected onClose() {
    this.eventEmitter.emit('close');
  }

  protected async onError(error) {
    this.eventEmitter.emit('error', error);
  }

  protected async onMessage(message) {
    try {
      const msg = JSON.parse(message.content);

      if ('type' in msg && 'payload' in msg) {
        await this.onWorkerMessage(msg.type, msg.payload);
        this.channel.ack(message);
      }
    } catch (error) {
      await this.onError(error);
    }
  }

  protected onWorkerMessage(type: string, payload: object) {
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

  protected sendToQueue(routingKey: string, payload: object) {
    const payloadBuffer = Buffer.from(JSON.stringify(payload));

    this.channel.sendToQueue(routingKey, payloadBuffer);
  }

  public async sendMessage(whose: { workerName: string, network?: BlockchainNetworks }, type: string, payload: object) {
    const routingKey = `BridgeWorkers.${whose.workerName}.${
      whose.network
        ? whose.network
        : '*'
    }`;

    await this.sendToQueue(routingKey, { type, payload });
  }
}
