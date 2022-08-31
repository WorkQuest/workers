import EventEmitter from "events";
import {EventData} from "web3-eth-contract";
import {ILogger} from "../logging/logging.interfaces";
import {BlocksRange, ReceivedEvents} from "../middleware.types";
import {Log} from "@ethersproject/abstract-provider/src.ts/index";
import {IContractListenerProvider} from "./contract-providers.interfaces";
import {IRouterClient} from "../message-oriented/message-queue.interfaces";
import {
  TaskRouterResponse,
  SubscriptionRouterTypes,
  TaskRouterGetLogsResponse,
  SubscriptionRouterResponse,
} from "../message-oriented/message-queue.types";

const requireNew = require('require-new');

export class ContractRouterProvider implements IContractListenerProvider {
  protected readonly AbiDecoder;
  protected readonly eventEmitter: EventEmitter;

  constructor(
    public readonly address: string,
    public readonly eventViewingHeight: number,
    protected readonly abi: object[],
    protected readonly Logger: ILogger,
    protected readonly routerClient: IRouterClient,
  ) {
    this.eventEmitter = new EventEmitter();
    this.AbiDecoder = requireNew('abi-decoder');

    this.AbiDecoder.addABI(this.abi);
  }

  /** Utils */
  private logsFilter(log: Log): boolean {
    return log.address && log.address.toLowerCase() === this.address.toLowerCase();
  }

  private decodeLogToEvent(log: Log[] | Log): EventData[] {
    if (Array.isArray(log)) {
      return this.AbiDecoder.decodeLogs(log);
    }

    return this.AbiDecoder.decodeLogs([log]);
  }

  private createTaskGetLogs(blocksRange: BlocksRange) {
    return new Promise(async (resolve, reject) => {
      const taskKey = await this.routerClient.sendTaskGetLogs(blocksRange, this.address, 1);

      this.eventEmitter.once('server-started', () => {
        this.Logger.warn('Server restarted. All tasks will be canceled.');

        resolve({ logs: [], maxBlockHeightViewed: blocksRange.from - 1 })
      });
      this.eventEmitter.once(`task-response.${taskKey}`, (taskResponse: TaskRouterGetLogsResponse) => {
        this.Logger.info('Completed task (task key: "%s") came from the router.', taskResponse.key);

        resolve(taskResponse.data);
      });
    }) as Promise<{
      logs: Log[],
      maxBlockHeightViewed: number,
    }>;
  }

  /** On handlers */
  private onEventDataHandler(eventData) {
    this.Logger.debug('Decoded event data from the router server. Event: %o', eventData);

    this.eventEmitter.emit('events', eventData);
  }

  private onServerTaskExecutorStartedHandler() {
    this.Logger.info('Task executor router server restarted');

    this.eventEmitter.emit('server-task-executor-started');
  }

  private onNewLogsHandler(logs: Log[]) {
    this.Logger.debug(
      'New logs from the router server. Number of logs: "%s". Logs: %o',
      logs.length,
      logs,
    );

    const events = this.decodeLogToEvent(
      logs.filter(this.logsFilter)
    );

    this.Logger.debug('New events data from the router server. Number of events: "%s"', events.length);

    for (const event of events) {
      this.onEventDataHandler(event);
    }
  }

  private async onTaskResponseHandler(taskResponse: TaskRouterResponse) {
    this.Logger.debug('The router server completed the task. Task response: %o', taskResponse);

    this.eventEmitter.emit(`task-response.${taskResponse.key}`, taskResponse);
  }

  private onRouterSubscriptionResponseHandler(response: SubscriptionRouterResponse) {
    this.Logger.debug('New reply by subscribing to notifications: %o', response);

    if (response.subscription === SubscriptionRouterTypes.NewLogs) {
      this.onNewLogsHandler(response.data.logs);
    } else if (response.subscription === SubscriptionRouterTypes.TaskExecutorServerStarted) {
      this.onServerTaskExecutorStartedHandler();
    }
  }

  /** Providers interfaces */
  public on(type, callBack): void {
    if (type === 'error') {
      this.eventEmitter.addListener('error', callBack);
    } else if (type === 'events') {
      this.eventEmitter.addListener('events', callBack);
    } else if (type === 'close') {
      this.eventEmitter.addListener('close', callBack);
    }
  }

  public startListener(): this {
    this.routerClient.on('task-response', this.onTaskResponseHandler.bind(this));
    this.routerClient.on('subscription-response', this.onRouterSubscriptionResponseHandler.bind(this));

    // this.Logger.info('Start listener on contract address: "%s"', this.contract.options.address);

    return this;
  }

  public async getEvents(blocksRange: BlocksRange, callback: (events: ReceivedEvents) => void) {
    this.Logger.debug(
      'Get events: from block number: "%s", to block number: "%s"',
      blocksRange.from,
      blocksRange.to,
    );

    const taskKey = await this.routerClient.sendTaskGetLogs(blocksRange, this.address, 1);

    this.eventEmitter.once('server-task-executor-started', () => {
      this.Logger.warn('Server restarted. All tasks will be canceled.');

      callback({ events: [], lastBlockNumber: blocksRange.from - 1 });
    });
    this.eventEmitter.once(`task-response.${taskKey}`, (taskResponse: TaskRouterGetLogsResponse) => {
      this.Logger.info('Completed task (task key: "%s") came from the router.', taskResponse.key);

      this.eventEmitter.removeAllListeners('server-task-executor-started');

      callback({
        events: this.AbiDecoder.decodeLogs(taskResponse.data.logs),
        lastBlockNumber: taskResponse.data.maxBlockHeightViewed,
      });
    });
  }
}
