import Web3 from "web3";
import EventEmitter from "events";
import {BlocksRange} from "../../../types";
import {Contract, EventData} from "web3-eth-contract";
import {Log} from "@ethersproject/abstract-provider/src.ts/index";
import {
  ILogger,
  IRouterClient,
  IContractProvider,
  IContractListenerProvider,
} from "../../../middleware/middleware.interfaces";
import {
  TaskRouterResponse,
  SubscriptionRouterTypes,
  SubscriptionRouterResponse,
  ContractRpcProviderSettings,
} from "../../../middleware/middleware.types";

const requireNew = require('require-new');
const AbiDecoder = requireNew('abi-decoder');

export class BridgeRpcProvider implements IContractProvider {
  protected readonly settings: ContractRpcProviderSettings;

  constructor(
    public readonly address: string,
    public readonly eventViewingHeight: number,
    protected readonly web3: Web3,
    public readonly contract: Contract,
    protected readonly Logger: ILogger,
  ) {
    this.settings = { blockAssembler: { steps: 6000 } }
  }

  public async getEvents(fromBlockNumber: number) {
    const { steps } = this.settings.blockAssembler;
    const collectedEvents: EventData[] = [];
    const lastBlockNumber = await this.web3.eth.getBlockNumber();

    let fromBlock = fromBlockNumber;
    let toBlock = fromBlock + steps;

    try {
      while (true) {
        if (toBlock >= lastBlockNumber) {
          this.Logger.info('Getting events in a range: from "%s", to "%s"', fromBlock, lastBlockNumber);

          const eventsData = await this.contract.getPastEvents('allEvents', { fromBlock, toBlock: lastBlockNumber });

          collectedEvents.push(...eventsData);

          this.Logger.info('Collected events per range: "%s". Collected events: "%s". Left to collect blocks "%s"',
            eventsData.length,
            collectedEvents.length,
            lastBlockNumber - toBlock,
          );

          break;
        }

        this.Logger.info('Getting events in a range: from "%s", to "%s"', fromBlock, toBlock);

        const eventsData = await this.contract.getPastEvents('allEvents', { fromBlock, toBlock });

        collectedEvents.push(...eventsData);

        this.Logger.info('Collected events per range: "%s". Collected events: "%s"', eventsData.length, collectedEvents.length);

        fromBlock += steps;
        toBlock = fromBlock + steps - 1;
      }
    } catch (error) {
      this.Logger.error(error, 'Collection of all events ended with an error.' +
        ' Collected events to block number: "%s". Total collected events',
        fromBlock, collectedEvents.length,
      );

      return { events: collectedEvents, error, lastBlockNumber: fromBlock };
    }

    return { events: collectedEvents, lastBlockNumber };
  }
}

export class BridgeRouterProvider implements IContractListenerProvider {
  private readonly eventEmitter: EventEmitter;

  constructor(
    public readonly address: string,
    public readonly eventViewingHeight: number,
    public readonly contract: Contract,
    protected readonly abi: object[],
    protected readonly Logger: ILogger,
    protected readonly routerClient: IRouterClient,
  ) {
    AbiDecoder.addABI(this.abi);

    this.eventEmitter = new EventEmitter();
  }

  private logsFilter(log: Log): boolean {
    return log.address && log.address.toLowerCase() === this.address.toLowerCase();
  }

  private decodeLogToEvent(log: Log[] | Log): EventData[] {
    if (Array.isArray(log)) {
      return AbiDecoder.decodeLogs(log);
    }

    return AbiDecoder.decodeLogs([log]);
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
      events: AbiDecoder.decodeLogs(logs),
      lastBlockNumber: maxBlockHeightViewed,
    }
  }
}

export class BridgeWsProvider extends BridgeRpcProvider implements IContractListenerProvider {
  private readonly eventEmitter: EventEmitter;

  constructor(
    public readonly address: string,
    public readonly eventViewingHeight: number,
    protected readonly web3: Web3,
    public readonly contract: Contract,
    protected readonly Logger: ILogger,
  ) {
    super(address, eventViewingHeight, web3, contract, Logger);

    this.eventEmitter = new EventEmitter();
  }

  private onErrorHandler(error) {
    this.eventEmitter.emit('error', error);
  }

  private onEventDataHandler(eventData) {
    this.eventEmitter.emit('events', eventData);
  }

  public startListener(fromBlockNumber?: number) {
    this.contract.events
      .allEvents({ fromBlock: fromBlockNumber || "latest" })
      .on('error', (error) => this.onErrorHandler(error))
      .on('data', (eventData) => this.onEventDataHandler(eventData))

    this.Logger.info('Start listener on contract: "%s"', this.contract.options.address);
  }

  public on(type, callBack): void {
    if (type === 'error') {
      this.eventEmitter.addListener('error', callBack);
    } else if (type === 'events') {
      this.eventEmitter.addListener('events', callBack);
    }
  }

  public isListening(): Promise<boolean> {
    return this.web3.eth.net.isListening();
  }
}
