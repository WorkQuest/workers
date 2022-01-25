import { Contract, EventData, PastEventOptions } from 'web3-eth-contract';
import { BridgeProvider } from './BridgeProvider';

export interface BridgeEventData extends EventData {
  nonce: number;
  amount: string;
  recipient: string;
  sender: string;
  chainFrom: number;
  chainTo: number;
  symbol: string;
  blockNumber: number;
  transactionHash: string;
}

export type BridgeEventType = {
  timestamp: number;
  sender: string;
  recipient: string;
  amount: string;
  chainFrom: number;
  chainTo: number;
  nonce: number;
  symbol: string;
  event: string;
  messageHash: string;
  transactionHash: string;
  blockNumber: number;
};

export type onEventCallBack = {
  (eventData: BridgeEventType): void;
};

export class BridgeContract {
  private readonly _address: string;
  private readonly _contract: Contract;
  private readonly _provider: BridgeProvider;
  private readonly _preParsingSteps = 6000;

  private readonly _onEventCallBacks: onEventCallBack[] = [];

  constructor(provider: BridgeProvider, address: string, abiItems: any[]) {
    this._contract = provider.makeContract(abiItems, address);
    this._address = address;
    this._provider = provider;
  }

  private async _parseEventData(eventData: BridgeEventData): Promise<BridgeEventType> {
    const event: BridgeEventType = {
      timestamp: eventData.returnValues.timestamp,
      sender: eventData.returnValues.sender,
      recipient: eventData.returnValues.recipient,
      amount: eventData.returnValues.amount,
      chainFrom: eventData.returnValues.chainFrom,
      chainTo: eventData.returnValues.chainTo,
      nonce: eventData.returnValues.nonce,
      symbol: eventData.returnValues.symbol,
      transactionHash: eventData.transactionHash,
      blockNumber: eventData.blockNumber,
      event: eventData.event,
      messageHash: null,
    };

    return this._singEventData(event);
  }

  private async _parseEventsData(eventsData: BridgeEventData[]): Promise<BridgeEventType[]> {
    return Promise.all(eventsData.map(async (data) => await this._parseEventData(data)));
  }

  private async _onEventData(eventData: BridgeEventData) {
    const event = await this._parseEventData(eventData);

    this._provider.lastTrackedBlock = eventData.blockNumber;

    this._onEventCallBacks.forEach((callBack) => callBack(event));
  }

  private _eventListenerInit(fromBlock: number) {
    this._contract.events
      .allEvents({ fromBlock })
      .on('error', (err) => {
        console.error(err);
      })
      .on('data', (data: BridgeEventData) => this._onEventData(data));
  }

  private async _singEventData(event: BridgeEventType): Promise<BridgeEventType> {
    const fields = [event.nonce, event.amount, event.recipient, event.sender, event.chainFrom, event.chainTo, event.symbol];

    try {
      event.messageHash = (await this._provider.sing(fields)).message;
    } catch (_) {}

    return event;
  }

  public async startListener() {
    const fromBlock = await this._provider.getBlockNumber();

    this._provider.lastTrackedBlock = fromBlock;

    this._eventListenerInit(fromBlock);
  }

  public signCallbackOnEvent(callBack: onEventCallBack) {
    this._onEventCallBacks.push(callBack);
  }

  public async getPastEvents(event: string, options: PastEventOptions): Promise<any[]> {
    return this._contract.getPastEvents(event, options);
  }

  public async *preParsingEvents() {
    const lastBlockNumber = await this._provider.getBlockNumber();

    let fromBlock = this._provider.lastTrackedBlock;
    let toBlock = fromBlock + this._preParsingSteps;

    while (true) {
      const eventsData = await this.getPastEvents('allEvents', { fromBlock, toBlock });
      const events = await this._parseEventsData(eventsData);

      yield events;

      fromBlock += this._preParsingSteps;
      toBlock = fromBlock + this._preParsingSteps;

      if (toBlock >= lastBlockNumber) {
        const eventsData = await this.getPastEvents('allEvents', { fromBlock, toBlock });
        const events = await this._parseEventsData(eventsData);

        yield events;
        break;
      }
    }
  }
}
