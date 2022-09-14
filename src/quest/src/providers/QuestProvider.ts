import { Transaction } from "web3-eth";
import { Logger } from "../../logger/pino";
import { EventData } from "web3-eth-contract";
import {IContractMQProvider, QuestClients} from "./types";

const requireNew = require('require-new');

const asyncFilter = async (arr, predicate) => {
  const results = await Promise.all(arr.map(predicate));

  return arr.filter((_v, index) => results[index]);
}

export class QuestMQProvider implements IContractMQProvider {
  protected readonly AbiDecoder;
  private readonly preParsingSteps = 6000;
  private readonly callbacks = { 'events': [], 'error': [] };

  constructor (
    protected readonly abi: any[],
    public readonly eventViewingHeight: number,
    public readonly clients: QuestClients,
  ) {
    this.AbiDecoder = requireNew('abi-decoder');
    this.AbiDecoder.addABI(this.abi);
  }

  private decodeLogToEvent(log: any[] | any): EventData[] {
    if (Array.isArray(log)) {
      return this.AbiDecoder.decodeLogs(log);
    }

    return this.AbiDecoder.decodeLogs([log]);
  }

  private async onEventFromBroker(payload: { transactions: Transaction[] }) {
    Logger.info('Quest queue listener provider: received messages from the queue');
    Logger.debug('Quest queue listener provider: received messages from the queue with payload %o', payload);

    const tracedTxs: Transaction[] = await asyncFilter(payload.transactions, async tx =>
      tx.to && await this.clients.questCacheProvider.get(tx.to.toLowerCase())
    );

    Logger.info('Quest queue listener provider: number of contract transactions "%s"', tracedTxs.length);
    Logger.debug('Quest queue listener provider: contract transactions %o', tracedTxs);

   for (const tx of tracedTxs) {
     const questAddress = tx.to;
     const fromBlock = tx.blockNumber;
     const toBlock = tx.blockNumber;

     const contract = new this.clients.web3.eth.Contract(this.abi, questAddress);
     const eventsData = await contract.getPastEvents('allEvents', { fromBlock, toBlock });

     Logger.debug('Quest queue listener provider (address "%s"): contract events %o', questAddress, eventsData);
     Logger.info('Quest queue listener provider (address "%s"): range from block "%s", to block "%s". Events number: "%s"',
       fromBlock,
       toBlock,
       eventsData.length,
     );

     await Promise.all(
       eventsData.map(async data => this.onEventData(data))
     );
   }
  }

  private onEventData(eventData) {
    return Promise.all(
      this.callbacks['events'].map(async callBack => callBack(eventData)),
    );
  }

  public async startListener() {
    await this.clients.transactionsBroker.initConsumer(this.onEventFromBroker.bind(this));

    Logger.info('Start listener');
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

    if (fromBlock >= toBlock || fromBlock > lastBlockNumber) {
      return { events: [], lastBlockNumber: fromBlock }
    }

    try {
      while (true) {
        if (toBlock >= lastBlockNumber) {
          Logger.info('Getting events in a range: from "%s", to "%s"', fromBlock, lastBlockNumber);

          const logs = await this.clients.web3.eth.getPastLogs({
            fromBlock, toBlock: lastBlockNumber,
          });

          const trackedLogs = await asyncFilter(logs, async log => !!(
            await this.clients.questCacheProvider.get(log.address.toLowerCase())
          ));

          if (trackedLogs.length !== 0) {
            collectedEvents.push(
              ...this.decodeLogToEvent(trackedLogs)
            )
          }

          break;
        }

        Logger.info('Getting events in a range: from "%s", to "%s"', fromBlock, toBlock);

        const logs = await this.clients.web3.eth.getPastLogs({
          fromBlock, toBlock,
        });

        const trackedLogs = await asyncFilter(logs, async log => !!(
          await this.clients.questCacheProvider.get(log.address.toLowerCase())
        ));

        if (trackedLogs.length !== 0) {
          collectedEvents.push(
            ...this.decodeLogToEvent(trackedLogs)
          )
        }

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
