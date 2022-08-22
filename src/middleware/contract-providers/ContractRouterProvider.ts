import EventEmitter from "events";
import {BlocksRange} from "../../types";
import {ILogger} from "../logging/logging.interfaces";
import {Contract, EventData} from "web3-eth-contract";
import {Log} from "@ethersproject/abstract-provider/src.ts/index";
import {IContractListenerProvider} from "./contract-providers.interfaces";
import {IRouterClient} from "../message-oriented/message-queue.interfaces";
import {
  TaskRouterResponse,
  SubscriptionRouterTypes,
  SubscriptionRouterResponse,
} from "../message-oriented/message-queue.types";

const requireNew = require('require-new');

export class ContractRouterProvider implements IContractListenerProvider {
  protected readonly AbiDecoder;
  protected readonly eventEmitter: EventEmitter;

  constructor(
    public readonly address: string,
    public readonly eventViewingHeight: number,
    public readonly contract: Contract,
    protected readonly abi: object[],
    protected readonly Logger: ILogger,
    protected readonly routerClient: IRouterClient,
  ) {
    this.eventEmitter = new EventEmitter();
    this.AbiDecoder = requireNew('abi-decoder');

    this.AbiDecoder.addABI(this.abi);
  }

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

      this.eventEmitter.once(`task-response.${taskKey}`, resolve);
    }) as Promise<{
      logs: Log[],
      maxBlockHeightViewed: number,
    }>;
  }



  private onEventDataHandler(eventData) {
    this.eventEmitter.emit('events', eventData);
  }

  private async onNewLogsHandler(logs: Log[]) {
    const events = this.decodeLogToEvent(
      logs.filter(this.logsFilter)
    );

    for (const event of events) {
      this.onEventDataHandler(event);
    }
  }

  private async onTaskResponseHandler(taskResponse: TaskRouterResponse) {
    this.eventEmitter.emit(`task-response.${taskResponse.key}`, taskResponse);
  }

  private async onRouterSubscriptionResponseHandler(response: SubscriptionRouterResponse) {
    if (response.subscription === SubscriptionRouterTypes.NewLogs) {
      await this.onNewLogsHandler(response.data.logs);
    }
  }


  public on(type, callBack): void {
    if (type === 'error') {
      this.eventEmitter.addListener('error', callBack);
    } else if (type === 'events') {
      this.eventEmitter.addListener('events', callBack);
    } else if (type === 'close') {
      this.eventEmitter.addListener('close', callBack);
    }
  }

  public startListener() {
    this.routerClient.on('task-response', this.onTaskResponseHandler);
    this.routerClient.on('subscription-response', this.onRouterSubscriptionResponseHandler);

    this.Logger.info('Start listener on contract: "%s"', this.contract.options.address);
  }

  public async getEvents(fromBlockNumber: number, toBlockNumber: number | 'latest' = 'latest') {
    const { maxBlockHeightViewed, logs } = await this.createTaskGetLogs({
      from: fromBlockNumber,
      to: toBlockNumber,
    });

    return {
      events: this.AbiDecoder.decodeLogs(logs),
      lastBlockNumber: maxBlockHeightViewed,
    }
  }
}
