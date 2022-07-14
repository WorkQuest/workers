import Web3 from "web3";
import {Transaction} from "web3-eth";
import {Logger} from "../../logger/pino";
import { Contract, EventData} from "web3-eth-contract";
import {IContractProvider, IContractListenerProvider} from "./types";
import {ITransactionListener, IBridgeBetweenWorkers} from "../../../middleware";

export class ReferralProvider implements IContractProvider {
  private readonly preParsingSteps = 6000;

  constructor (
    public readonly address: string,
    public readonly eventViewingHeight: number,
    protected readonly web3: Web3,
    public readonly contract: Contract,
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

          collectedEvents.push(...eventsData);

          Logger.info('Collected events per range: "%s". Collected events: "%s"', eventsData.length, collectedEvents.length);

          break;

        }

        Logger.info('Getting events in a range: from "%s", to "%s"', fromBlock, toBlock);

        const eventsData = await this.contract.getPastEvents('allEvents', { fromBlock, toBlock });

        collectedEvents.push(...eventsData);

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

export class ReferralMQProvider extends ReferralProvider implements IContractListenerProvider {
  private readonly callbacks = { 'events': [], 'error': [] };

  constructor (
    public readonly address: string,
    public readonly eventViewingHeight: number,
    protected readonly web3: Web3,
    public readonly contract: Contract,
    protected readonly txListener: ITransactionListener,
    protected readonly bridgeBetweenWorkers: IBridgeBetweenWorkers,
  ) {
    super(address, eventViewingHeight, web3, contract);
  }

  private transactionFilter(tx: Transaction): boolean {
    return tx.to && tx.to.toLowerCase() === this.address.toLowerCase();
  }

  private async checkBlock(blockNumber: number) {
    const eventsData = await this.contract.getPastEvents('allEvents', {
      toBlock: blockNumber,
      fromBlock: blockNumber,
    });

    if (eventsData.length === 0) {
      return;
    }

    await Promise.all(
      eventsData.map(async data => this.onEventData(data))
    );
  }

  private async onMessageFromOtherWorkers(whose: string, type: string, payload: object) {
    if (whose === 'referral' && type === 'check-block') {
      const { blockNumber } = payload as { blockNumber };

      await this.checkBlock(blockNumber);
    }
  }

  private async onTransactions(payload: { transactions: Transaction[] }) {
    if (payload.transactions.length === 0) {
      return;
    }

    const eventsData = await this.contract.getPastEvents('allEvents', {
      toBlock: payload.transactions[payload.transactions.length - 1].blockNumber,
      fromBlock: payload.transactions[0].blockNumber,
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

  public isListening(): Promise<boolean> {
    // @ts-ignore
    return true;
  }

  public startListener() {
    this.txListener.setFiltering(this.transactionFilter.bind(this));
    this.txListener.on('transactions', this.onTransactions.bind(this));
    this.bridgeBetweenWorkers.on('worker-message', this.onMessageFromOtherWorkers.bind(this));

    Logger.info('Start listener on contract: "%s"', this.contract.options.address);
  }

  public on(type, callBack): void {
    if (type === 'error') {
      this.callbacks['error'].push(callBack);
    } else if (type === 'events') {
      this.callbacks['events'].push(callBack);
    }
  }
}
