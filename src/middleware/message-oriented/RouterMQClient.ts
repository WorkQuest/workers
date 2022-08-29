import EventEmitter from "events";
import generator from "generate-key";
import {BlocksRange} from "../../types";
import amqp, {Channel, Connection} from "amqplib";
import {ConsumeMessage} from "amqplib/properties";
import {IRouterClient} from "./message-queue.interfaces";
import {TaskKey, TaskPriority, TaskTypes} from "../utilis/utilits.types";
import {BlockchainNetworks} from "@workquest/database-models/lib/models";
import {
  TaskGetLogsRequest,
  TaskRouterRequest,
  TaskRouterResponse,
  SubscriptionRouterResponse,
} from "./message-queue.types";

export class RouterMQClient implements IRouterClient {
  protected channel: Channel;
  protected connection: Connection;

  private readonly eventEmitter: EventEmitter;

  /**
   * Router Exchanges.
   * These exchanges inits on RouterServer.
   * "Router.TaskRequestExchange" -
   * "Router.TaskResponseExchange" -
   * "Router.SubscriptionExchange" - Fanout Exchange
   */
  protected get routerTaskRequestExchange  () { return `${this.network}.Router.TaskRequestExchange`  }
  protected get routerTaskResponseExchange () { return `${this.network}.Router.TaskResponseExchange` }
  protected get routerSubscriptionExchange () { return `${this.network}.Router.SubscriptionExchange` }

  /**
   * Exchange/Queue RouterServer.
   * "Router.Server.TaskRequests" -
   */
  protected get routerServerRequestsQueue () { return `${this.network}.Router.Server.TaskRequests` }

  /**
   * Exchange/Queue RouterClient.
   *
   * *network*.Router.Client.*client-name*.TaskResponses - Responses from server server completed tasks (for example get logs).
   *
   * *network*.Router.Client.*client-name*.SubscriptionAnswers - Getting new logs from the router server.
   */
  protected get routerClientTaskResponsesQueue () { return `${this.network}.Router.Client.${this.clientName}.TaskResponses`         }
  protected get routerClientSubscriptionsQueue () { return `${this.network}.Router.Client.${this.clientName}.SubscriptionResponses` }

  constructor(
    private readonly mqLink: string,
    public readonly clientName: string,
    private readonly network: BlockchainNetworks,
  ) {
    this.eventEmitter = new EventEmitter();
  }

  public async init(): Promise<this> {
    this.connection = await amqp.connect(this.mqLink, 'heartbeat=60');

    this.connection.on('error', this.onErrorHandler.bind(this));
    this.connection.on('close', this.onCloseHandler.bind(this));

    this.channel = await this.connection.createChannel();

    await this.channel.assertQueue(this.routerClientSubscriptionsQueue, {
      durable: false,
      exclusive: false,
      autoDelete: true,
      messageTtl: 10000,
    });

    await this.channel.bindQueue(
      this.routerClientSubscriptionsQueue,
      this.routerSubscriptionExchange,
      ''
    );

    await this.channel.consume(
      this.routerClientSubscriptionsQueue,
      this.onSubscriptionResponseHandler.bind(this),
    );

    await this.channel.assertQueue(this.routerClientTaskResponsesQueue, {
      durable: true,
      exclusive: false,
    });
    await this.channel.bindQueue(
      this.routerClientTaskResponsesQueue,
      this.routerTaskResponseExchange,
      this.routerClientTaskResponsesQueue,
    );
    await this.channel.consume(
      this.routerClientTaskResponsesQueue,
      this.onTaskResponseHandler.bind(this),
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

    this.channel.ack(msg);
  }

  protected onSubscriptionResponseHandler(msg: ConsumeMessage | null) {
    try {
      if (msg) {
        const response: SubscriptionRouterResponse = JSON.parse(msg.content.toString());

        this.eventEmitter.emit('subscription-response', response);
      }
    } catch (error) {

    }
  }

  private async sendRequestToExecuteTask(taskRequest: TaskRouterRequest) {
    this.channel.publish(
      this.routerTaskRequestExchange,
      this.routerServerRequestsQueue,
      Buffer.from(JSON.stringify(taskRequest)),
    )
  }

  public on(type, callback): this {
    if (type === 'close') {
      this.eventEmitter.addListener('close', callback);
    } else if (type === 'error') {
      this.eventEmitter.addListener('error', callback);
    } else if (type === 'task-response') {
      this.eventEmitter.addListener('task-response', callback);
    } else if (type === 'subscription-response') {
      this.eventEmitter.addListener('subscription-response', callback);
    }

    return this;
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
