import Web3 from "web3";
import {Transaction} from "web3-eth";
import {EventData} from "web3-eth-contract";
import {ITransactionListener} from "../../../middleware";
import {IContractListenerProvider, IContractProvider, ILogger, IQuestCacheProvider} from "./types";

const asyncFilter = async (arr, predicate) => {
  const results = await Promise.all(arr.map(predicate));

  return arr.filter((_v, index) => results[index]);
}

export class QuestProvider implements IContractProvider {
  private readonly preParsingSteps = 6000;

  constructor (
    protected readonly abi: any[],
    protected readonly web3: Web3,
    protected readonly Logger: ILogger,
    public readonly eventViewingHeight: number,
    protected readonly questCacheProvider: IQuestCacheProvider,
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

          const blocks = await Promise.all(
            [...Array(lastBlockNumber - fromBlock).keys()]
              .map(i => i + fromBlock + 1)
              .map(async bn => this.web3.eth.getBlock(bn, true))
          );

          const txs = blocks
            .map(block => block.transactions)
            .reduce((prev, current) => [...prev, ...current]);

          this.Logger.debug(
            'Assembled transactions: %o',
            txs.map(tx => ({ to: tx.to, from: tx.from, hash: tx.hash })),
          );

          const tracedTxs = await asyncFilter(txs, async tx =>
            tx.to && await this.questCacheProvider.get(tx.to.toLowerCase())
          );

          this.Logger.debug(
            'Traceable transactions: %o',
            tracedTxs.map(tx => ({ to: tx.to, from: tx.from, hash: tx.hash })),
          );

          for (const tx of tracedTxs) {
            this.Logger.debug('Traceable transaction: %o', tx);

            const contract = new this.web3.eth.Contract(this.abi, tx.to);
            const eventsData = await contract.getPastEvents('allEvents', { fromBlock, toBlock: lastBlockNumber });

            collectedEvents.push(...eventsData);

            this.Logger.info('Collected events per range: "%s". Collected events: "%s"', eventsData.length, collectedEvents.length);
            this.Logger.info('The end of the collection of events on the contract. Total events: "%s"', collectedEvents.length);
          }

          break;
        }

        this.Logger.info('Getting events in a range: from "%s", to "%s"', fromBlock, toBlock);

        const blocks = await Promise.all(
          [...Array(toBlock - fromBlock).keys()]
            .map(i => i + fromBlock + 1)
            .map(async bn => this.web3.eth.getBlock(bn, true))
        );

        const txs = blocks
          .map(block => block.transactions)
          .reduce((prev, current) => [...prev, ...current]);

        this.Logger.debug(
          'Assembled transactions: %o',
          txs.map(tx => ({ to: tx.to, from: tx.from, hash: tx.hash })),
        );

        const tracedTxs = await asyncFilter(txs, async tx =>
          tx.to && await this.questCacheProvider.get(tx.to.toLowerCase())
        );

        this.Logger.debug(
          'Traceable transactions: %o',
          tracedTxs.map(tx => ({ to: tx.to, from: tx.from, hash: tx.hash })),
        );

        for (const tx of tracedTxs) {
          this.Logger.debug('Traceable transaction: %o', { to: tx.to, from: tx.from, hash: tx.hash });

          const contract = new this.web3.eth.Contract(this.abi, tx.to);
          const eventsData = await contract.getPastEvents('allEvents', { fromBlock, toBlock });

          collectedEvents.push(...eventsData);

          this.Logger.info('Collected events per range: "%s". Collected events: "%s"', eventsData.length, collectedEvents.length);
        }

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

export class QuestMQProvider extends QuestProvider implements IContractListenerProvider {
  private readonly callbacks = { 'events': [], 'error': [] };

  constructor (
    protected readonly abi: any[],
    protected readonly web3: Web3,
    protected readonly Logger: ILogger,
    public readonly eventViewingHeight: number,
    protected readonly txListener: ITransactionListener,
    protected readonly questCacheProvider: IQuestCacheProvider,
  ) {
    super(abi, web3, Logger, eventViewingHeight, questCacheProvider);
  }

  private async transactionFilter(tx: Transaction): Promise<boolean> {
    return tx.to && !!(await this.questCacheProvider.get(tx.to.toLowerCase()));
  }

  private async onTransactions(payload: { transactions: Transaction[] }) {
    this.Logger.debug('Quest queue listener provider: received messages from the queue with payload %o', payload);

    if (payload.transactions.length === 0) {
      return;
    }

    this.Logger.info('Quest queue listener provider: number of contract transactions "%s"', payload.transactions.length);
    this.Logger.debug('Quest queue listener provider: contract transactions %o', payload.transactions);

   for (const tx of payload.transactions) {
     const questAddress = tx.to;
     const fromBlock = tx.blockNumber;
     const toBlock = tx.blockNumber;

     const contract = new this.web3.eth.Contract(this.abi, questAddress);
     const eventsData = await contract.getPastEvents('allEvents', { fromBlock, toBlock });

     this.Logger.debug('Quest queue listener provider (address "%s"): contract events %o', questAddress, eventsData);
     this.Logger.info('Quest queue listener provider (address "%s"): range from block "%s", to block "%s". Events number: "%s"',
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
    this.txListener.setFiltering(this.transactionFilter.bind(this));
    this.txListener.on('transactions', this.onTransactions.bind(this));

    this.Logger.info('Start listener');
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
