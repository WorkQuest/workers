import fs from "fs";
import path from "path";
import { EventData } from "web3-eth-contract";
import { onEventCallBack, IContractProvider, QuestClients } from "./types";
import { Logger } from "../../logger/pino";
import {Transaction} from "web3-eth";

const abiFilePath = path.join(__dirname, '/../../abi/WorkQuest.json');
const abi: any[] = JSON.parse(fs.readFileSync(abiFilePath).toString()).abi;

const asyncFilter = async (arr, predicate) => {
  const results = await Promise.all(arr.map(predicate));

  return arr.filter((_v, index) => results[index]);
}

export class QuestProvider implements IContractProvider {
  private readonly onEventCallBacks: onEventCallBack[] = [];

  private readonly preParsingSteps = 100;

  constructor (
    public readonly clients: QuestClients,
  ) {};

  private async initBrokerListener() {
    await this.clients.transactionsBroker.initConsumer(this.onEventFromBroker.bind(this));
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

     const contract = new this.clients.web3.eth.Contract(abi, questAddress);
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
      this.onEventCallBacks.map(async callBack => callBack(eventData))
    );
  }

  public async startListener() {
    Logger.info('Start listening');

    await this.initBrokerListener();
  }

  public subscribeOnEvents(onEventCallBack: onEventCallBack): void {
    this.onEventCallBacks.push(onEventCallBack);
  }

  public async getAllEvents(fromBlockNumber: number) {
    const collectedEvents: EventData[] = [];
    const lastBlockNumber = await this.clients.web3.eth.getBlockNumber();

    Logger.info('Last block number: "%s"', lastBlockNumber);
    Logger.info('Range getting all events with contract: from "%s", to "%s". Steps: "%s"', fromBlockNumber, lastBlockNumber, this.preParsingSteps);

    let fromBlock = fromBlockNumber;
    let toBlock = fromBlock + this.preParsingSteps;

    try {
      while (true) {
        if (toBlock >= lastBlockNumber) {
          Logger.info('Getting events in a range: from "%s", to "%s"', fromBlock, lastBlockNumber);

          const blocks = await Promise.all(
            [...Array(lastBlockNumber - fromBlock).keys()]
              .map(i => i + fromBlock + 1)
              .map(async bn => this.clients.web3.eth.getBlock(bn, true))
          );

          const txs = blocks
            .map(block => block.transactions)
            .reduce((prev, current) => [...prev, ...current]);

          Logger.debug(
            'Assembled transactions: %o',
            txs.map(tx => ({ to: tx.to, from: tx.from, hash: tx.hash })),
          );

          const tracedTxs = await asyncFilter(txs, async tx =>
            tx.to && await this.clients.questCacheProvider.get(tx.to.toLowerCase())
          );

          Logger.debug(
            'Traceable transactions: %o',
            tracedTxs.map(tx => ({ to: tx.to, from: tx.from, hash: tx.hash })),
          );

          for (const tx of tracedTxs) {
            Logger.debug('Traceable transaction: %o', tx);

            const contract = new this.clients.web3.eth.Contract(abi, tx.to);
            const eventsData = await contract.getPastEvents('allEvents', { fromBlock, toBlock: lastBlockNumber });

            collectedEvents.push(...eventsData);

            Logger.info('Collected events per range: "%s". Collected events: "%s"', eventsData.length, collectedEvents.length);
            Logger.info('The end of the collection of events on the contract. Total events: "%s"', collectedEvents.length);
          }

          break;
        }

        Logger.info('Getting events in a range: from "%s", to "%s"', fromBlock, toBlock);

        const blocks = await Promise.all(
          [...Array(toBlock - fromBlock).keys()]
            .map(i => i + fromBlock + 1)
            .map(async bn => this.clients.web3.eth.getBlock(bn, true))
        );

        const txs = blocks
          .map(block => block.transactions)
          .reduce((prev, current) => [...prev, ...current]);

        Logger.debug(
          'Assembled transactions: %o',
          txs.map(tx => ({ to: tx.to, from: tx.from, hash: tx.hash })),
        );

        const tracedTxs = await asyncFilter(txs, async tx =>
          tx.to && await this.clients.questCacheProvider.get(tx.to.toLowerCase())
        );

        Logger.debug(
          'Traceable transactions: %o',
          tracedTxs.map(tx => ({ to: tx.to, from: tx.from, hash: tx.hash })),
        );

        for (const tx of tracedTxs) {
          Logger.debug('Traceable transaction: %o', { to: tx.to, from: tx.from, hash: tx.hash });

          const contract = new this.clients.web3.eth.Contract(abi, tx.to);
          const eventsData = await contract.getPastEvents('allEvents', { fromBlock, toBlock });

          collectedEvents.push(...eventsData);

          Logger.info('Collected events per range: "%s". Collected events: "%s"', eventsData.length, collectedEvents.length);
        }

        fromBlock += this.preParsingSteps;
        toBlock = fromBlock + this.preParsingSteps - 1;
      }
    } catch (error) {
      Logger.error(error, 'Collection of all events ended with an error.' +
        ' Collected events to block number: "%s". Total collected events',
        fromBlock, collectedEvents.length,
      );

      return { collectedEvents, error, lastBlockNumber: fromBlock };
    }

    return { collectedEvents, lastBlockNumber };
  }
}
