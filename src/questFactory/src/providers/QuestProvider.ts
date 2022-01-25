import Web3 from 'web3';
import { Contract, EventData } from 'web3-eth-contract';
import { onEventCallBack, Web3Provider } from './types';
import { QuestFactoryEvent } from '../controllers/types';

export class QuestProvider implements Web3Provider {
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

    let fromBlock = fromBlockNumber;
    let toBlock = fromBlock + this.preParsingSteps;

    try {
      while (true) {
        const eventsData = await this.contract.getPastEvents(QuestFactoryEvent.Created, { fromBlock, toBlock });

        collectedEvents.push(...eventsData);

        console.info('Block from: ', fromBlock, ' block to: ', toBlock);

        fromBlock += this.preParsingSteps;
        toBlock = fromBlock + this.preParsingSteps - 1;

        if (toBlock >= lastBlockNumber) {
          const eventsData = await this.contract.getPastEvents(QuestFactoryEvent.Created, {
            fromBlock,
            toBlock: await this.web3.eth.getBlockNumber(),
          });

          collectedEvents.push(...eventsData);
          break;
        }
      }
    } catch (error) {
      console.error(error);
      console.error('GetAllEvents: Last block: ', collectedEvents[collectedEvents.length - 1].blockNumber);

      return { collectedEvents, isGotAllEvents: false };
    }

    return { collectedEvents, isGotAllEvents: true };
  }
}
