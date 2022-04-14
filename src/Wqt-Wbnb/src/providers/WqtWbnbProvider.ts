import Web3 from 'web3';
import { Logger } from "../../logger/pino";
import { Contract, EventData } from 'web3-eth-contract';
import { onEventCallBack, Web3Provider } from './types';

export class WqtWbnbProvider implements Web3Provider {
  private readonly onEventCallBacks: onEventCallBack[] = [];

  private readonly preParsingSteps = 6000;

  constructor(public readonly web3: Web3, public readonly contract: Contract) {}

  private onEventData(eventData) {
    this.onEventCallBacks.forEach((callBack) => callBack(eventData));
  }

  private _eventListenerInit(fromBlock: number) {
    this.contract.events
      .allEvents({ fromBlock })
      .on('error', (err) => {
        console.error(err);
      })
      .on('data', (data) => this.onEventData(data));
  }

  public async startListener(): Promise<void> {
    const lastBlockNumber = await this.web3.eth.getBlockNumber();

    this._eventListenerInit(lastBlockNumber);
  }

  public subscribeOnEvents(onEventCallBack: onEventCallBack): void {
    this.onEventCallBacks.push(onEventCallBack);
  }

  public async getAllEvents(fromBlockNumber: number) {
    const collectedEvents: EventData[] = [];
    const lastBlockNumber = await this.web3.eth.getBlockNumber();

    Logger.info('Start collecting all uncollected events from block number: "%s", last block number "%s"',
      fromBlockNumber,
      lastBlockNumber,
    );

    let fromBlock = fromBlockNumber;
    let toBlock = fromBlock + this.preParsingSteps;

    try {
      while (true) {
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

        if (toBlock >= lastBlockNumber) {
          Logger.info('Getting events in a range: from "%s", to "%s"', fromBlock, lastBlockNumber);

          const eventsData = await this.contract.getPastEvents('allEvents', { fromBlock, toBlock });

          collectedEvents.push(...eventsData);

          Logger.info('Collected events per range: "%s". Collected events: "%s"', eventsData.length, collectedEvents.length);

          break;
        }
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
