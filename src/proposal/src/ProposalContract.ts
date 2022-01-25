import { Contract, EventData, PastEventOptions } from 'web3-eth-contract';
import { ProposalProvider } from './ProposalProvider';

export interface ProposalEventData extends EventData {
  blockNumber: number;
  timestamp: string;
  nonce: string;
  transactionHash: string;
  transId: string;
  proposer: string;
  description: string;
  votingPeriod: string;
  minimumQuorum: string;
  event: string;
}

export type ProposalEventType = {
  blockNumber: number;
  timestamp: string;
  nonce: string;
  transactionHash: string;
  transId: string;
  proposer: string;
  description: string;
  votingPeriod: string;
  minimumQuorum: string;
  event: string;
  voter: string;
  proposalId: string;
  support: boolean;
  votes: string;
  succeded: boolean;
  defeated: boolean;
};

export type onEventCallBack = {
  (eventData: ProposalEventType): void;
};

export class ProposalContract {
  private readonly _address: string;
  private readonly _contract: Contract;
  private readonly _provider: ProposalProvider;
  private readonly _preParsingSteps = 6000;

  private readonly _onEventCallBacks: onEventCallBack[] = [];

  constructor(provider: ProposalProvider, address: string, abiItems: any[]) {
    this._contract = provider.makeContract(abiItems, address);
    this._address = address;
    this._provider = provider;
  }

  private static async _parseEventData(eventData: ProposalEventData): Promise<ProposalEventType> {
    const event: ProposalEventType = {
      blockNumber: eventData.blockNumber,
      timestamp: eventData.returnValues.timestamp,
      nonce: eventData.returnValues.nonce,
      transactionHash: eventData.transactionHash,
      transId: eventData.returnValues.id,
      proposer: eventData.returnValues.proposer,
      description: eventData.returnValues.description,
      votingPeriod: eventData.returnValues.votingPeriod,
      minimumQuorum: eventData.returnValues.minimumQuorum,
      event: eventData.event,
      voter: eventData.returnValues.voter,
      proposalId: eventData.returnValues.proposalId,
      support: eventData.returnValues.support,
      votes: eventData.returnValues.votes,
      succeded: eventData.returnValues.succeded,
      defeated: eventData.returnValues.defeated,
    };
    return event;
  }

  private async _parseEventsData(eventsData: ProposalEventData[]): Promise<ProposalEventType[]> {
    return Promise.all(eventsData.map(async (data) => await ProposalContract._parseEventData(data)));
  }

  private async _onEventData(eventData: ProposalEventData) {
    const event = await ProposalContract._parseEventData(eventData);

    this._provider.lastTrackedBlock = eventData.blockNumber;

    this._onEventCallBacks.forEach((callBack) => callBack(event));
  }

  private _eventListenerInit(fromBlock: number) {
    this._contract.events
      .allEvents({ fromBlock })
      .on('error', console.error)
      .on('data', (data: ProposalEventData) => this._onEventData(data));
  }

  public signCallbackOnEvent(callBack: onEventCallBack) {
    this._onEventCallBacks.push(callBack);
  }

  public async startListener() {
    const fromBlock = await this._provider.getBlockNumber();

    this._provider.lastTrackedBlock = fromBlock;

    this._eventListenerInit(fromBlock);
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
