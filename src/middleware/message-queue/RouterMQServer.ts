import EventEmitter from 'events';
import {IRouterServer} from "./message-queue.interfaces";
import {Log} from "@ethersproject/abstract-provider/src.ts/index";
import amqp from "amqplib";

export class RouterMQServer implements IRouterServer {
  private channel;
  private connection;

  private readonly quaeName = 'RouterServer';
  private readonly eventEmitter: EventEmitter;

  constructor(

  ) {
    this.eventEmitter = new EventEmitter();
  }

  public async init(): Promise<this> {
    this.connection = await amqp.connect(this.mqLink, 'heartbeat=60');

    this.connection.on('error', this.onErrorHandler.bind(this));
    this.connection.on('close', this.onCloseHandler.bind(this));

    this.channel = await this.connection.createChannel();

    await Promise.all([
      this.channel.assertQueue(this.clientName),

      this.channel.consume(
        `${this.clientName}.TaskResponse`,
        this.onTaskResponseHandler.bind(this),
      ),
      this.channel.consume(
        'RouterServer.SubscriptionResponse',
        this.onSubscriptionResponseHandler.bind(this),
      ),
    ]);

    return this;
  }

  public on(type, callback) {
    if (type === 'close') {
      this.eventEmitter.addListener('close', callback);
    } else if (type === 'error') {
      this.eventEmitter.addListener('error', callback);
    } else if (type === 'task-request') {
      this.eventEmitter.addListener('task-request', callback);
    }
  }

  public async notifyEveryoneAboutNewLogs(logs: Log[]) {

  }
  public async  sendExecutedTaskGetLogs(clientName: string, logs: Log[]) {

  }
}
