import EventEmitter from "events";
import generator from "generate-key";
import {BlocksRange} from "../../types";
import amqp, {Channel, Connection} from "amqplib";
import {ConsumeMessage} from "amqplib/properties";
import {IRouterClient} from "./message-queue.interfaces";
import {TaskKey, TaskPriority, TaskTypes} from "../utilis/utilits.types";
import {
  TaskRouterRequest,
  TaskGetLogsRequest,
  TaskRouterResponse,
  SubscriptionRouterResponse,
} from "./message-queue.types";

export class RouterMQClient implements IRouterClient {
  protected connection: Connection;

  protected tasksChannel: Channel;
  protected subscriptionChannel: Channel;

  private readonly eventEmitter: EventEmitter;

  /**
   * Router Exchanges.
   * These exchanges inits on RouterServer.
   * "Router.TaskRequestExchange" -
   * "Router.TaskResponseExchange" -
   * "Router.SubscriptionExchange" - Fanout Exchange
   */
  protected readonly routerTaskRequestExchange = 'Router.TaskRequestExchange';
  protected readonly routerTaskResponseExchange = 'Router.TaskResponseExchange';
  protected readonly routerSubscriptionExchange = 'Router.SubscriptionExchange';

  /**
   * Exchange/Queue RouterServer.
   * "Router.Server.TaskRequests" -
   */
  protected readonly routerServerRequestsQueue = 'Router.Server.TaskRequests';

  /**
   * Exchange/Queue RouterClient.
   * Router.Client.*client-name*.TaskResponses -
   * Router.Client.*client-name*.SubscriptionAnswers -
   *
   */
  protected readonly routerClientTaskResponsesQueue = () => `Router.Client.${this.clientName}.TaskResponses`;
  protected readonly routerClientSubscriptionsQueue = () => `Router.Client.${this.clientName}.SubscriptionResponses`;

  constructor(
    private readonly mqLink: string,
    public readonly clientName: string,
  ) {
    this.eventEmitter = new EventEmitter();
  }

  public async init(): Promise<this> {
    this.connection = await amqp.connect(this.mqLink, 'heartbeat=60');

    this.connection.on('error', this.onErrorHandler.bind(this));
    this.connection.on('close', this.onCloseHandler.bind(this));

    this.tasksChannel = await this.connection.createChannel();
    this.subscriptionChannel = await this.connection.createChannel();

    await this.subscriptionChannel.assertQueue(this.routerClientSubscriptionsQueue(), {
      durable: false,
      exclusive: false,
      autoDelete: true,
      messageTtl: 10000,
    });
    await this.subscriptionChannel.bindQueue(
      this.routerClientSubscriptionsQueue(),
      this.routerSubscriptionExchange,
      ''
    );
    await this.subscriptionChannel.consume(
      this.routerClientSubscriptionsQueue(),
      this.onTaskResponseHandler.bind(this),
    );

    await this.tasksChannel.assertQueue(this.routerClientTaskResponsesQueue(), {
      durable: true,
      exclusive: false,
    });
    await this.tasksChannel.bindQueue(
      this.routerClientTaskResponsesQueue(),
      this.routerTaskResponseExchange,
      this.routerClientTaskResponsesQueue(),
    );
    await this.tasksChannel.consume(
      this.routerClientTaskResponsesQueue(),
      this.onSubscriptionResponseHandler.bind(this),
    );

    return this;
  }


  protected onCloseHandler() {
    this.eventEmitter.emit('close');
  }

  protected onErrorHandler(error) {
    this.eventEmitter.emit('error', error);
  }

  protected onTaskResponseHandler(msg: ConsumeMessage | null) {
    if (msg) {
      const response: TaskRouterResponse = JSON.parse(msg.content.toString());

      this.eventEmitter.emit('task-response', response);
    }

    this.tasksChannel.ack(msg);
  }

  protected onSubscriptionResponseHandler(msg: ConsumeMessage | null) {
    if (msg) {
      const response: SubscriptionRouterResponse = JSON.parse(msg.content.toString());

      this.eventEmitter.emit('subscription-response', response);
    }

    this.subscriptionChannel.ack(msg);
  }

  private async sendRequestToExecuteTask(taskRequest: TaskRouterRequest) {
    this.tasksChannel.publish(
      this.routerTaskRequestExchange,
      this.routerServerRequestsQueue,
      Buffer.from(JSON.stringify(taskRequest)),
    );
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
