import Web3 from "web3";
import {Transaction} from "web3-eth";
import {Contract, EventData} from "web3-eth-contract";
import {ITransactionListener} from "../../../middleware";
import {IContractListenerProvider, IContractProvider, ILogger} from "./types";

export class RaiseViewProvider implements IContractProvider {
  private readonly preParsingSteps = 6000;

  constructor(
    public readonly address: string,
    public readonly eventViewingHeight: number,
    public readonly web3: Web3,
    public readonly contract: Contract,
    protected readonly Logger: ILogger,
  ) {
  }

  public async getEvents(fromBlockNumber: number) {
    const collectedEvents: EventData[] = [];
    const lastBlockNumber = await this.web3.eth.getBlockNumber();

    this.Logger.info('Last block number: "%s"', lastBlockNumber);
    this.Logger.info('Range getting all events with contract: from "%s", to "%s". Steps: "%s"', fromBlockNumber, lastBlockNumber, this.preParsingSteps);

    let fromBlock = fromBlockNumber;
    let toBlock = fromBlock + this.preParsingSteps;

    try {
      while (true) {
        if (toBlock >= lastBlockNumber) {
          this.Logger.info('Getting events in a range: from "%s", to "%s"', fromBlock, lastBlockNumber);

          const eventsData = await this.contract.getPastEvents('allEvents', { fromBlock, toBlock: lastBlockNumber });

          collectedEvents.push(...eventsData);

          this.Logger.info('Collected events per range: "%s". Collected events: "%s"', eventsData.length, collectedEvents.length);
          this.Logger.info('The end of the collection of events on the contract. Total events: "%s"', collectedEvents.length);

          break;
        }

        this.Logger.info('Getting events in a range: from "%s", to "%s"', fromBlock, toBlock);

        const eventsData = await this.contract.getPastEvents('allEvents', { fromBlock, toBlock });

        collectedEvents.push(...eventsData);

        this.Logger.info('Collected events per range: "%s". Collected events: "%s"', eventsData.length, collectedEvents.length);

        fromBlock += this.preParsingSteps;
        toBlock = fromBlock + this.preParsingSteps - 1;
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

export class RaiseViewMQProvider extends RaiseViewProvider implements IContractListenerProvider {
  private readonly callbacks = { 'events': [], 'error': [] };

  constructor (
    public readonly address: string,
    public readonly eventViewingHeight: number,
    public readonly web3: Web3,
    public readonly contract: Contract,
    protected readonly Logger: ILogger,
    protected readonly txListener: ITransactionListener,
  ) {
    super(address, eventViewingHeight, web3, contract, Logger);
  }

  private async onTransactions(payload: { transactions: Transaction[] }) {
    this.Logger.info('Raise-view listener: message "onEventFromBroker"');
    this.Logger.debug('Raise-view listener: message "onEventFromBroker" with payload %o', payload);

    this.Logger.info('Raise-view listener provider: number of contract transactions "%s"', payload.transactions.length);
    this.Logger.debug('Raise-view listener provider: contract transactions %o', payload.transactions);

    if (payload.transactions.length === 0) {
      return;
    }

    const eventsData = await this.contract.getPastEvents('allEvents', {
      toBlock: payload.transactions[payload.transactions.length - 1].blockNumber,
      fromBlock: payload.transactions[0].blockNumber,
    });

    const fromBlock = payload.transactions[0].blockNumber;
    const toBlock = payload.transactions[payload.transactions.length - 1].blockNumber;

    this.Logger.debug('Raise-view listener provider: contract events %o', eventsData);
    this.Logger.info('Raise-view listener provider: range from block "%s", to block "%s". Events number: "%s"',
      fromBlock,
      toBlock,
      eventsData.length,
    );

    return Promise.all(
      eventsData.map(async data => this.onEventData(data))
    );
  }

  private transactionFilter(tx: Transaction): boolean {
    return tx.to && tx.to.toLowerCase() === this.address.toLowerCase();
  }

  public async startListener() {
    this.txListener.setFiltering(this.transactionFilter.bind(this));
    this.txListener.on('transactions', this.onTransactions.bind(this));

    this.Logger.info('Start listener');
  }

  public isListening(): Promise<boolean> {
    // @ts-ignore
    return true;
  }

  private onEventData(eventData) {
    return Promise.all(
      this.callbacks['events'].map(async callBack => callBack(eventData)),
    );
  }

  public on(type, callBack): void {
    if (type === 'error') {
      this.callbacks['error'].push(callBack);
    } else if (type === 'events') {
      this.callbacks['events'].push(callBack);
    }
  }
}
