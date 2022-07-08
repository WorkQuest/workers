import Web3 from "web3";
import {Transaction } from "web3-eth";
import { Logger } from "../../logger/pino";
import { Contract, EventData } from "web3-eth-contract";
import {TransactionBroker} from "../../../brokers/src/TransactionBroker";
import {
  IContractWsProvider,
  IContractMQProvider,
  IContractRpcProvider,
} from "./types";

export class BridgeMQProvider implements IContractMQProvider {
  private readonly preParsingSteps = 6000;
  private readonly callbacks = { 'events': [], 'error': [] };

  constructor(
    public readonly address: string,
    public readonly eventViewingHeight: number,
    public readonly contract: Contract,
    protected readonly web3: Web3,
    protected readonly txBroker: TransactionBroker,
  ) {
  }

  private async onEventFromBroker(payload: { transactions: Transaction[] }) {
    const tracedTxs = payload
      .transactions
      .filter(tx => tx.to && tx.to.toLowerCase() === this.address.toLowerCase())
      .sort((a, b) => a.blockNumber = b.blockNumber);

    if (tracedTxs.length === 0) {
      return;
    }

    const eventsData = await this.contract.getPastEvents('allEvents', {
      toBlock: tracedTxs[tracedTxs.length - 1].blockNumber,
      fromBlock: tracedTxs[0].blockNumber,
    });

    return Promise.all(
      eventsData.map(async data => this.onEventData(data))
    );
  }

  private onEventData(eventData) {
    return Promise.all(
      this.callbacks['events'].map(async callBack => callBack(eventData)),
    );
  }

  public async startListener() {
    await this.txBroker.initConsumer(this.onEventFromBroker.bind(this))

    Logger.info('Start listener on contract: "%s"', this.contract.options.address);
  }

  public on(type, callBack): void {
    if (type === 'error') {
      this.callbacks['error'].push(callBack);
    } else if (type === 'events') {
      this.callbacks['events'].push(callBack);
    }
  }

  public async getEvents(fromBlockNumber: number) {
    const collectedEvents: EventData[] = [];
    const lastBlockNumber = await this.web3.eth.getBlockNumber();

    let fromBlock = fromBlockNumber;
    let toBlock = fromBlock + this.preParsingSteps;

    try {
      while (true) {
        if (toBlock >= lastBlockNumber) {
          Logger.info('Getting events in a range: from "%s", to "%s"', fromBlock, lastBlockNumber);

          const eventsData = await this.contract.getPastEvents('allEvents', { fromBlock, toBlock: lastBlockNumber });

          collectedEvents.push(...eventsData);

          Logger.info('Collected events per range: "%s". Collected events: "%s". Left to collect blocks "%s"',
            eventsData.length,
            collectedEvents.length,
            lastBlockNumber - toBlock,
          );

          break;
        }

        Logger.info('Getting events in a range: from "%s", to "%s"', fromBlock, toBlock);

        const eventsData = await this.contract.getPastEvents('allEvents', { fromBlock, toBlock });

        collectedEvents.push(...eventsData);

        Logger.info('Collected events per range: "%s". Collected events: "%s"', eventsData.length, collectedEvents.length);

        fromBlock += this.preParsingSteps;
        toBlock = fromBlock + this.preParsingSteps - 1;
      }
    } catch (error) {
      Logger.error(error, 'Collection of all events ended with an error.' +
        ' Collected events to block number: "%s". Total collected events',
        fromBlock, collectedEvents.length,
      );

      return { events: collectedEvents, error, lastBlockNumber: fromBlock };
    }

    return { events: collectedEvents, lastBlockNumber };
  }
}

export class BridgeWsProvider implements IContractWsProvider {
  private readonly preParsingSteps = 6000;
  private readonly callbacks = { 'events': [], 'error': [] };

  constructor(
    public readonly address: string,
    public readonly eventViewingHeight: number,
    public readonly contract: Contract,
    protected readonly web3: Web3,
  ) {
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

    Logger.info('Start listener on contract: "%s"', this.contract.options.address);
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

  public async getEvents(fromBlockNumber: number) {
    const collectedEvents: EventData[] = [];
    const lastBlockNumber = await this.web3.eth.getBlockNumber();

    let fromBlock = fromBlockNumber;
    let toBlock = fromBlock + this.preParsingSteps;

    try {
      while (true) {
        if (toBlock >= lastBlockNumber) {
          Logger.info('Getting events in a range: from "%s", to "%s"', fromBlock, lastBlockNumber);

          const eventsData = await this.contract.getPastEvents('allEvents', { fromBlock, toBlock: lastBlockNumber });

          if (eventsData !== undefined) {
            collectedEvents.push(...eventsData);

            Logger.info('Collected events per range: "%s". Collected events: "%s"', eventsData.length, collectedEvents.length);

            break;
          }
        }

        Logger.info('Getting events in a range: from "%s", to "%s"', fromBlock, toBlock);

        const eventsData = await this.contract.getPastEvents('allEvents', { fromBlock, toBlock });

        if (eventsData !== undefined) {
          collectedEvents.push(...eventsData);
        }

        Logger.info('Collected events per range: "%s". Collected events: "%s". Left to collect blocks "%s"',
          eventsData.length,
          collectedEvents.length,
          lastBlockNumber - toBlock,
        );

        fromBlock += this.preParsingSteps;
        toBlock = fromBlock + this.preParsingSteps - 1;
      }
    } catch (error) {
      Logger.error(error, 'Collection of all events ended with an error.' +
        ' Collected events to block number: "%s". Total collected events',
        fromBlock, collectedEvents.length,
      );

      return { events: collectedEvents, error, lastBlockNumber: fromBlock };
    }

    return { events: collectedEvents, lastBlockNumber };
  }
}

export class BridgeRpcProvider implements IContractRpcProvider {
  private readonly preParsingSteps = 2000;

  constructor(
    public readonly address: string,
    public readonly eventViewingHeight: number,
    public readonly contract: Contract,
    protected readonly web3: Web3,
  ) {
  }

  public async getEvents(fromBlockNumber: number) {
    const collectedEvents: EventData[] = [];
    const lastBlockNumber = await this.web3.eth.getBlockNumber();

    let fromBlock = fromBlockNumber;
    let toBlock = fromBlock + this.preParsingSteps;

    try {
      while (true) {
        if (toBlock >= lastBlockNumber) {
          Logger.info('Getting events in a range: from "%s", to "%s"', fromBlock, lastBlockNumber);

          const eventsData = await this.contract.getPastEvents('allEvents', { fromBlock, toBlock: lastBlockNumber });

          if (eventsData !== undefined) {
            collectedEvents.push(...eventsData);

            Logger.info('Collected events per range: "%s". Collected events: "%s"', eventsData.length, collectedEvents.length);

            break;
          }
        }

        Logger.info('Getting events in a range: from "%s", to "%s"', fromBlock, toBlock);

        const eventsData = await this.contract.getPastEvents('allEvents', { fromBlock, toBlock });

        if (eventsData !== undefined) {
          collectedEvents.push(...eventsData);
        }

        Logger.info('Collected events per range: "%s". Collected events: "%s". Left to collect blocks "%s"',
          eventsData.length,
          collectedEvents.length,
          lastBlockNumber - toBlock,
        );

        fromBlock += this.preParsingSteps;
        toBlock = fromBlock + this.preParsingSteps - 1;
      }
    } catch (error) {
      Logger.error(error, 'Collection of all events ended with an error.' +
        ' Collected events to block number: "%s". Total collected events',
        fromBlock, collectedEvents.length,
      );

      return { events: collectedEvents, error, lastBlockNumber: fromBlock };
    }

    return { events: collectedEvents, lastBlockNumber };
  }
}
