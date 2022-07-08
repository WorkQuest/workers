import {Transaction} from "web3-eth";
import {Logger} from "../../logger/pino";
import {Contract, EventData} from "web3-eth-contract";
import {IContractMQProvider, QuestFactoryClients} from "./types";

export class QuestFactoryMQProvider implements IContractMQProvider {
  private readonly preParsingSteps = 6000;
  private readonly callbacks = { 'events': [], 'error': [] };

  constructor (
    public readonly address: string,
    public readonly eventViewingHeight: number,
    public readonly contract: Contract,
    public readonly clients: QuestFactoryClients,
  ) {
  };

  private async onEventFromBroker(payload: { transactions: Transaction[] }) {
    Logger.info('Quest-factory queue listener provider: received messages from the queue');
    Logger.debug('Quest-factory queue listener provider: received messages from the queue with payload %o', payload);

    const tracedTxs = payload
      .transactions
      .filter(tx => tx.to && tx.to.toLowerCase() === this.address.toLowerCase())
      .sort((a, b) => a.blockNumber = b.blockNumber)

    Logger.info('Quest-factory queue listener provider: number of contract transactions "%s"', tracedTxs.length);
    Logger.debug('Quest-factory queue listener provider: contract transactions %o', tracedTxs);

    if (tracedTxs.length === 0) {
      return;
    }

    const fromBlock = tracedTxs[0].blockNumber;
    const toBlock = tracedTxs[tracedTxs.length - 1].blockNumber;

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
    await this.clients.transactionsBroker.initConsumer(this.onEventFromBroker.bind(this));

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
    const lastBlockNumber = await this.clients.web3.eth.getBlockNumber();

    Logger.info('Last block number: "%s"', lastBlockNumber);
    Logger.info('Range getting all events with contract: from "%s", to "%s". Steps: "%s"', fromBlockNumber, lastBlockNumber, this.preParsingSteps);

    let fromBlock = fromBlockNumber;
    let toBlock = fromBlock + this.preParsingSteps;

    if (fromBlock >= toBlock) {
      return { events: [], lastBlockNumber: fromBlock }
    }

    try {
      while (true) {
        if (toBlock > lastBlockNumber) {
          break;
        }
        if (toBlock === lastBlockNumber) {
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
