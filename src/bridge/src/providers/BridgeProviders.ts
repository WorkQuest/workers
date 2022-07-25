import Web3 from "web3";
import {Contract, EventData} from "web3-eth-contract";
import {Log} from "@ethersproject/abstract-provider/src.ts/index";
import {
  ILogger,
  IContractProvider,
  IContractListenerProvider,
} from "../../../interfaces";
import {
  TaskTypes,
  TaskResponse,
  IRouterClient,
  SubscriptionTypes,
  SubscriptionResponse, BlocksRange,
} from "../../../middleware/";

const requireNew = require('require-new');
const AbiDecoder = requireNew('abi-decoder');

export class BridgeRpcProvider implements IContractProvider {
  protected readonly settings: {
    readonly preParsingSteps: number;
  } = {
    preParsingSteps: 6000,
  }

  constructor(
    public readonly address: string,
    public readonly eventViewingHeight: number,
    protected readonly web3: Web3,
    public readonly contract: Contract,
    protected readonly Logger: ILogger,
  ) {
  }

  public async getEvents(fromBlockNumber: number) {
    const collectedEvents: EventData[] = [];
    const lastBlockNumber = await this.web3.eth.getBlockNumber();

    let fromBlock = fromBlockNumber;
    let toBlock = fromBlock + this.settings.preParsingSteps;

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

        fromBlock += this.settings.preParsingSteps;
        toBlock = fromBlock + this.settings.preParsingSteps - 1;
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
  private readonly callbacks: {
    'error': ((error) => void) [],
    'events': ((eventData) => void) [],
    'tasks': Map<string, (logs) => void>,
  } = {
    'error': [],
    'events': [],
    'tasks': new Map(),
  }

  constructor(
    public readonly address: string,
    public readonly eventViewingHeight: number,
    protected readonly web3: Web3,
    public readonly contract: Contract,
    protected readonly abi: object[],
    protected readonly Logger: ILogger,
    protected readonly routerClient: IRouterClient,
  ) {
    AbiDecoder.addABI(this.abi);
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

  private createTaskGetLogs(blocksRange: BlocksRange): Promise<{ maxBlockHeightViewed, logs }> {
    return new Promise(async (resolve, reject) => {
      const taskKey = await this.routerClient.sendTaskGetLogs({
        to: blocksRange.to,
        from: blocksRange.from,
      }, this.address);

      this.callbacks["tasks"].set(taskKey, (taskResponse: TaskResponse) => {
        const { maxBlockHeightViewed, logs, key, task } = taskResponse.data;

        if (key !== taskKey && task !== TaskTypes.GetLogs) {
          return;
        }

        resolve({ maxBlockHeightViewed, logs });

        this.callbacks["tasks"].delete(taskKey);
      });
    });
  }


  private onEventData(eventData) {
    return Promise.all(
      this.callbacks['events'].map(async callBack => callBack(eventData)),
    );
  }

  private async onNewLogs(logs: Log[]) {
    const events = this.decodeLogToEvent(
      logs.filter(this.logsFilter)
    );

    await Promise.all(
      events.map(async event => this.onEventData(event)),
    );
  }

  private async ontTaskResponse(taskResponse: TaskResponse) {
    for (const [, callBack] of this.callbacks["tasks"]) {
      callBack(taskResponse);
    }
  }

  private async onRouterSubscriptionResponse(response: SubscriptionResponse) {
    if (response.subscription === SubscriptionTypes.NewLogs) {
      await this.onNewLogs(response.data.logs);
    }
  }


  public on(type, callBack): void {
    if (type === 'error') {
      this.callbacks['error'].push(callBack);
    } else if (type === 'events') {
      this.callbacks['events'].push(callBack);
    }
  }

  public startListener() {
    this.routerClient.on('task-response', this.ontTaskResponse);
    this.routerClient.on('subscription-response', this.onRouterSubscriptionResponse);

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
  private readonly callbacks = { 'events': [], 'error': [] };

  constructor(
    public readonly address: string,
    public readonly eventViewingHeight: number,
    protected readonly web3: Web3,
    public readonly contract: Contract,
    protected readonly Logger: ILogger,
  ) {
    super(address, eventViewingHeight, web3, contract, Logger);
  }

  private onError(error) {
    return Promise.all(
      this.callbacks['error'].map(async (callBack) => {
        return callBack(error);
      }),
    );
  }

  private onEventData(eventData) {
    return Promise.all(
      this.callbacks['events'].map(async (callBack) => {
        return callBack(eventData);
      }),
    );
  }

  public startListener(fromBlockNumber?: number) {
    this.contract.events
      .allEvents({ fromBlock: fromBlockNumber || "latest" })
      .on('error', (error) => this.onError(error))
      .on('data', async (eventData) => await this.onEventData(eventData))

    this.Logger.info('Start listener on contract: "%s"', this.contract.options.address);
  }

  public on(type, callBack): void {
    if (type === 'error') {
      this.callbacks['error'].push(callBack);
    } else if (type === 'events') {
      this.callbacks['events'].push(callBack);
    }
  }

  public isListening(): Promise<boolean> {
    return this.web3.eth.net.isListening();
  }
}
