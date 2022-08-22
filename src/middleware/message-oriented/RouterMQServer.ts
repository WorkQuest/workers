import EventEmitter from 'events';
import amqp, {Channel, Connection} from "amqplib";
import {ConsumeMessage} from "amqplib/properties";
import {IRouterServer} from "./message-queue.interfaces";
import {TaskTypes} from "../utilis/task-queue/task-queue.types";
import {Log} from "@ethersproject/abstract-provider/src.ts/index";
import {BlockchainNetworks} from "@workquest/database-models/lib/models";
import {
  TaskRouterRequest,
  SubscriptionRouterTypes,
  TaskRouterGetLogsResponse,
  SubscriptionRouterNewLogsResponse,
} from "./message-queue.types";

export class RouterMQServer implements IRouterServer {
  private connection: Connection;

  protected subscriptionChannel: Channel;
  protected tasksRequestChannel: Channel;
  protected tasksResponseChannel: Channel;

  private readonly eventEmitter: EventEmitter;

  /**
   * Exchange/Queue RouterServer.
   * "Router.Server.TaskRequests" -
   */
  protected get routerServerRequestsQueue () { return `${this.network}.Router.Server.TaskRequests` }

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

  constructor(
    private readonly mqLink: string,
    private readonly network: BlockchainNetworks,
  ) {
    this.eventEmitter = new EventEmitter();
  }

  public async init(): Promise<this> {
    this.connection = await amqp.connect(this.mqLink, 'heartbeat=60');

    this.connection.on('error', this.onErrorHandler.bind(this));
    this.connection.on('close', this.onCloseHandler.bind(this));

    this.subscriptionChannel = await this.connection.createChannel();
    this.tasksRequestChannel = await this.connection.createChannel();
    this.tasksResponseChannel = await this.connection.createChannel();

    await this.subscriptionChannel.assertExchange(this.routerSubscriptionExchange, 'fanout', {
      durable: true,
    });
    await this.tasksResponseChannel.assertExchange(this.routerTaskResponseExchange, 'direct', {
      durable: true,
    });
    await this.tasksRequestChannel.assertExchange(this.routerTaskRequestExchange, 'direct', {
      durable: true,
    });

    await this.tasksRequestChannel.assertQueue(this.routerServerRequestsQueue, {
      durable: true,
      exclusive: true,
      messageTtl: 5000,
    });

    await this.tasksRequestChannel.bindQueue(
      this.routerServerRequestsQueue,
      this.routerTaskRequestExchange,
      this.routerServerRequestsQueue,
    );

    await this.tasksRequestChannel.consume(
      this.routerServerRequestsQueue,
      this.onTaskRequestHandler.bind(this),
    );

    return this;
  }

  protected onCloseHandler() {
    this.eventEmitter.emit('close');
  }

  protected onErrorHandler(error) {
    this.eventEmitter.emit('error', error);
  }

  protected onTaskRequestHandler(msg: ConsumeMessage | null) {
    console.log("onTaskRequestHandler: " + msg);

    if (msg) {
      const request: TaskRouterRequest = JSON.parse(msg.content.toString());

      this.eventEmitter.emit('task-request', request);
    }

    this.tasksRequestChannel.ack(msg);
  }

  public on(type, callback): this {
    if (type === 'close') {
      this.eventEmitter.addListener('close', callback);
    } else if (type === 'error') {
      this.eventEmitter.addListener('error', callback);
    } else if (type === 'task-request') {
      this.eventEmitter.addListener('task-request', callback);
    }

    return this;
  }

  public async notifyEveryoneAboutNewLogs(logs: Log[]) {
    const response: SubscriptionRouterNewLogsResponse = {
      subscription: SubscriptionRouterTypes.NewLogs,
      data: { logs },
    }
    const responseBuffer = Buffer.from(JSON.stringify(response));

    this.subscriptionChannel.publish(this.routerSubscriptionExchange, '', responseBuffer);
  }

  public async sendExecutedTaskGetLogs(clientName: string, task: { key: string, logs: Log[], maxBlockHeightViewed: number }) {
    const response: TaskRouterGetLogsResponse = {
      task: TaskTypes.GetLogs,
      key: task.key,
      data: {
        logs: task.logs,
        maxBlockHeightViewed: task.maxBlockHeightViewed,
      },
    }
    const responseBuffer = Buffer.from(JSON.stringify(response));

    this.subscriptionChannel.publish(this.routerTaskResponseExchange, clientName, responseBuffer);
  }
}
