import amqp from "amqplib";
import generator from "generate-key";
import EventEmitter from "events";
import {BlocksRange} from "../../types";
import {IRouterClient} from "./message-queue.interfaces";
import {TaskKey, TaskPriority, TaskTypes} from "../utilis/utilits.types";
import {
  TaskRouterRequest,
  TaskGetLogsRequest,
  TaskRouterResponse,
  SubscriptionRouterResponse,
} from "./message-queue.types";

export class RouterMQClient implements IRouterClient {
  protected channel;
  protected connection;

  private readonly eventEmitter: EventEmitter;

  constructor(
    private readonly mqLink: string,
    public readonly clientName: string,
  ) {
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


  protected onCloseHandler() {
    this.eventEmitter.emit('close');
  }

  protected onErrorHandler(error) {
    this.eventEmitter.emit('error', error);
  }

  protected async onTaskResponseHandler(response: TaskRouterResponse) {
    this.eventEmitter.emit('task-response', response);
  }

  protected async onSubscriptionResponseHandler(response: SubscriptionRouterResponse) {
    this.eventEmitter.emit('subscription-response', response);
  }

  private async sendRequestToExecuteTask (taskRequest: TaskRouterRequest) {
    const payloadBuffer = Buffer.from(JSON.stringify(taskRequest));

    await this.channel.sendToQueue('RouterServer.TaskRequest', payloadBuffer);
  }

  public on(type, callback) {
    if (type === 'close') {
      this.eventEmitter.addListener('close', callback);
    } else if (type === 'error') {
      this.eventEmitter.addListener('error', callback);
    } else if (type === 'task-response') {
      this.eventEmitter.addListener('task-response', callback);
    } else if (type === 'subscription-response') {
      this.eventEmitter.addListener('subscription-response', callback);
    }
  }

  public async sendTaskGetLogs(blocksRange: BlocksRange, addresses: string | string[], priority: TaskPriority): Promise<TaskKey> {
    const taskRequest: TaskGetLogsRequest = {
      priority,
      task: TaskTypes.GetLogs,
      clientName: this.clientName,
      key: generator.generateKey(),
      payload: { blocksRange, addresses },
    };

    await this.sendRequestToExecuteTask(taskRequest);

    return taskRequest.key;
  }
}
