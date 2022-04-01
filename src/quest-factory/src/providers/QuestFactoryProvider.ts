import { Logger } from "../../logger/pino";
import { Contract, EventData } from "web3-eth-contract";
import { onEventCallBack, IContractProvider, QuestFactoryClients } from "./types";
import { TransactionBroker } from "../../../brokers/src/TransactionBroker";

export class QuestFactoryProvider implements IContractProvider {
  private readonly onEventCallBacks: onEventCallBack[] = [];

  private readonly preParsingSteps = 6000;

  constructor (
    public readonly clients: QuestFactoryClients,
    public readonly contract: Contract,
    public readonly transactionBroker: TransactionBroker,
  ) {};

  private async initFatherProcessListener() {
    await this.transactionBroker.initConsumer(this.onEventFromFatherProcess.bind(this));
  }

  private async onEventFromFatherProcess(payload: { toBlock: number, fromBlock: number }) {
    Logger.info('Parent process listener: message "onEvents", payload %o', payload);

    const eventsData = await this.contract.getPastEvents('allEvents', {
      toBlock: payload.toBlock,
      fromBlock: payload.fromBlock,
    });

    Logger.info('Received events from contract. Range: from block "%s", to block "%s". Events: "%s"',
      payload.fromBlock,
      payload.toBlock,
      eventsData.length,
    );

    return Promise.all(
      eventsData.map(async data => this.onEventData(data))
    );
  }

  private onEventData(eventData) {
    return Promise.all(
      this.onEventCallBacks.map(async callBack => callBack(eventData))
    );
  }

  public async startListener() {
    Logger.info('Start listening');

    await this.initFatherProcessListener();
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

      return { collectedEvents, error, lastBlockNumber: fromBlock };
    }

    return { collectedEvents, lastBlockNumber };
  }
}
