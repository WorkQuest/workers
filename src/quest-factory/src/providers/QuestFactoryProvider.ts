import Web3 from "web3";
import {Transaction} from "web3-eth";
import {Logger} from "../../logger/pino";
import {Contract, EventData} from "web3-eth-contract";
import {ITransactionListener} from "../../../middleware";
import {IContractProvider, IContractListenerProvider} from "./types";

export class QuestFactoryProvider implements IContractProvider {
  private readonly preParsingSteps = 6000;

  constructor(
    public readonly address: string,
    public readonly eventViewingHeight: number,
    public readonly web3: Web3,
    public readonly contract: Contract,
  ) {
  }

  public async getEvents(fromBlockNumber: number) {
    const collectedEvents: EventData[] = [];
    const lastBlockNumber = await this.web3.eth.getBlockNumber();

    Logger.info('Last block number: "%s"', lastBlockNumber);
    Logger.info('Range getting all events with contract: from "%s", to "%s". Steps: "%s"', fromBlockNumber, lastBlockNumber, this.preParsingSteps);

    let fromBlock = fromBlockNumber;
    let toBlock = fromBlock + this.preParsingSteps;

    try {
      while (true) {
        if (toBlock >= lastBlockNumber) {
          Logger.info('Getting events in a range: from "%s", to "%s"', fromBlock, lastBlockNumber);

          const eventsData = await this.contract.getPastEvents('allEvents', { fromBlock, toBlock: lastBlockNumber });

          collectedEvents.push(...eventsData);

          Logger.info('Collected events per range: "%s". Collected events: "%s"', eventsData.length, collectedEvents.length);
          Logger.info('The end of the collection of events on the contract. Total events: "%s"', collectedEvents.length);

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

export class QuestFactoryMQProvider extends QuestFactoryProvider implements IContractListenerProvider {
  private readonly callbacks = { 'events': [], 'error': [] };

  constructor (
    public readonly address: string,
    public readonly eventViewingHeight: number,
    public readonly web3: Web3,
    public readonly contract: Contract,
    protected readonly txListener: ITransactionListener,
  ) {
    super(address, eventViewingHeight, web3, contract);
  }

  private transactionFilter(tx: Transaction): boolean {
    return tx.to && tx.to.toLowerCase() === this.address.toLowerCase();
  }

  private async onTransactions(payload: { transactions: Transaction[] }) {
    Logger.info('Quest-factory queue listener provider: received messages from the queue');
    Logger.debug('Quest-factory queue listener provider: received messages from the queue with payload %o', payload);

    Logger.info('Quest-factory queue listener provider: number of contract transactions "%s"', payload.transactions.length);
    Logger.debug('Quest-factory queue listener provider: contract transactions %o', payload.transactions);

    if (payload.transactions.length === 0) {
      return;
    }

    const fromBlock = payload.transactions[0].blockNumber;
    const toBlock = payload.transactions[payload.transactions.length - 1].blockNumber;

    const eventsData = await this.contract.getPastEvents('allEvents', { fromBlock, toBlock });

    Logger.debug('Quest-factory queue listener provider: contract events %o', eventsData);
    Logger.info('Quest-factory queue listener provider: range from block "%s", to block "%s". Events number: "%s"',
      fromBlock,
      toBlock,
      eventsData.length,
    );

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
    this.txListener.setFiltering(this.transactionFilter.bind(this));
    this.txListener.on('transactions', this.onTransactions.bind(this));

    Logger.info('Start listener on contract: "%s"', this.contract.options.address);
  }

  public isListening(): Promise<boolean> {
    // @ts-ignore
    return true;
  }

  public on(type, callBack): void {
    if (type === 'error') {
      this.callbacks['error'].push(callBack);
    } else if (type === 'events') {
      this.callbacks['events'].push(callBack);
    }
  }
}
