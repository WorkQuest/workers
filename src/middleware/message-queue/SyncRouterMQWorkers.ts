import amqp, { Channel, Connection, Message } from 'amqplib';
import {
  ISyncRouterWorkers,
  SyncRouterMessage,
  SyncRouterMessageType,
  SyncRouterRequest,
  SyncRouterRequestType,
  SyncRouterResponse,
  SyncRouterResponseType
} from "../types";

type SyncRouterEvents = 'error' | 'close' | 'sync-request' | 'sync-response';

export class SyncRouterMQWorkers implements ISyncRouterWorkers {
  protected channel: Channel;
  protected connection: Connection;

  private readonly callbacks = {
    'error': [],
    'close': [],
    'sync-response': [],
    'sync-request': []
  };

  private lastRequestData: SyncRouterRequest;
  private approveResponse: Function;

  constructor(
    protected readonly link: string,
    protected readonly queueName: string,
  ) {}

  public async init() {
    this.connection = await amqp.connect(this.link, 'heartbeat=60');

    this.connection.on('error', this.onError.bind(this));
    this.connection.on('close', this.onClose.bind(this));

    this.channel = await this.connection.createChannel();

    await this.channel.assertQueue(this.queueName);

    await this.channel.consume(this.queueName, this.onMessage.bind(this));
  }

  private async sendToQueue(payload: object, recipientQueue = 'fetcher') {
    try {
      const payloadBuffer = Buffer.from(JSON.stringify(payload));

      this.channel.sendToQueue(recipientQueue, payloadBuffer, {
        persistent: true
      });
    } catch (err) {
      await this.onError(err);
    }
  }

  private async callBackSubscribers(event: SyncRouterEvents, ...args: any[]) {
    await Promise.all(
      this.callbacks[event].map(async (callBack) => {
        return callBack(...args);
      }),
    );
  }

  protected async onMessage(message: Message) {
    try {
      const content: SyncRouterMessage<any> = JSON.parse(message.content.toString());

      if (!content.type) {
        return;
      }

      if (content.type === SyncRouterMessageType.Request) {
        await this.onSyncRequest(content);
      }

      if (content.type === SyncRouterMessageType.Response) {
        await this.onSyncResponse(content);
      }

      await this.channel.ack(message);
    } catch (error) {
      await this.onError(error);
    }
  }

  protected async onClose() {
    await this.callBackSubscribers('close');
  }

  protected async onError(error) {
    await this.callBackSubscribers('close', error);
  }

  protected async onSyncResponse(response: SyncRouterMessage<SyncRouterResponse>) {
    if (this.lastRequestData) {
      await this.callBackSubscribers('sync-response', response);
      await this.approveResponse();
    }
  }

  protected async onSyncRequest(request: SyncRouterMessage<SyncRouterRequest>) {
    await this.callBackSubscribers('sync-request', request);
  }

  public on(type: SyncRouterEvents, callback) {
    if (type === 'close') {
      this.callbacks[type].push(callback);
    } else if (type === 'error') {
      this.callbacks[type].push(callback);
    } else if (type === 'sync-request') {
      this.callbacks[type].push(callback);
    } else if (type === 'sync-response') {
      this.callbacks[type].push(callback);
    }

    return this;
  }

  protected awaitMessages() {
    return new Promise((resolveMessage) => {
      this.approveResponse = resolveMessage;
    });
  }

  public async sendSyncRequest(
    requestPayload: SyncRouterRequest,
    type: SyncRouterRequestType
  ) {
    this.lastRequestData = requestPayload;

    const payload: SyncRouterMessage<SyncRouterRequest> = {
      type: SyncRouterMessageType.Request,
      initiator: this.queueName,
      recipient: 'fetcher',
      payload: { type, data: requestPayload }
    }

    await this.sendToQueue(payload);
    await this.awaitMessages();
  }

  public async sendSyncResponse(
    responsePayload: SyncRouterResponse,
    recipientQueue: string,
    type: SyncRouterResponseType
  ) {
    const payload: SyncRouterMessage<SyncRouterResponse> = {
      type: SyncRouterMessageType.Response,
      initiator: this.queueName,
      recipient: recipientQueue,
      payload: { type, data: responsePayload }
    };

    await this.sendToQueue(payload, recipientQueue);
  }
}
