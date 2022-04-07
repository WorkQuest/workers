import { Contract, EventData } from "web3-eth-contract";
import { onEventCallBack, IContractProvider, Clients } from "./types";
import { Logger } from "../../logger/pino";

export class ChildProcessProvider implements IContractProvider {
  private readonly onEventCallBacks: onEventCallBack[] = [];

  private readonly preParsingSteps = 6000;

  constructor (
    public readonly clients: Clients,
    public readonly contract: Contract,
  ) {};

  private initFatherProcessListener() {
    process.on('message', async (message: string) => {
      await this.processMessage(message);
    });
  }

  private async processMessage(rawMessage: string) {
    let parsedMessage;

    try {
      parsedMessage = JSON.parse(rawMessage);

      if (!parsedMessage.message || parsedMessage.message !== 'onEvents') {
        return;
      }

      delete parsedMessage.message;
    } catch (err) {
      return;
    }

    await this.onEventFromFatherProcess(parsedMessage);
  }

  private async onEventFromFatherProcess(payload: { toBlock: number, fromBlock: number }) {
    const eventsData = await this.contract.getPastEvents('allEvents', payload);

    return Promise.all(
      eventsData.map(async data => this.onEventData(data))
    );
  }

  private onEventData(eventData) {
    return Promise.all(
      this.onEventCallBacks.map(async callBack => callBack(eventData))
    );
  }

  public startListener() {
    this.initFatherProcessListener();

    Logger.info('Start Proposal listener on contract: "%s"', this.contract.options.address);
  }

  public subscribeOnEvents(onEventCallBack: onEventCallBack): void {
    this.onEventCallBacks.push(onEventCallBack);
  }

  public async getAllEvents(fromBlockNumber: number) {
    const collectedEvents: EventData[] = [];
    const lastBlockNumber = await this.clients.web3.eth.getBlockNumber();

    let fromBlock = fromBlockNumber;
    let toBlock = fromBlock + this.preParsingSteps;

    try {
      while (true) {
        if (toBlock >= lastBlockNumber) {
          Logger.info('Getting events in a range: from "%s", to "%s"', fromBlock, lastBlockNumber);

          const eventsData = await this.contract.getPastEvents('allEvents', { fromBlock, toBlock: lastBlockNumber });

          if (eventsData !== undefined) {
            collectedEvents.push(...eventsData);

            Logger.info('Collected events per range: "%s". Collected events: "%s"', eventsData.length, collectedEvents.length);
            Logger.info('The end of the collection of events on the contract. Total events: "%s"', collectedEvents.length);

            break;
          }
        }

        Logger.info('Getting events in a range: from "%s", to "%s"', fromBlock, toBlock);

        const eventsData = await this.contract.getPastEvents('allEvents', { fromBlock, toBlock });

        if (eventsData !== undefined) {
          collectedEvents.push(...eventsData);
        }

        Logger.info('Collected events per range: "%s". Collected events: "%s"', eventsData.length, collectedEvents.length);

        fromBlock += this.preParsingSteps;
        toBlock = fromBlock + this.preParsingSteps - 1;
      }
    } catch (error) {
      Logger.error(error, 'Collection of all events ended with an error.' +
        ' Collected events to block number: "%s". Total collected events',
        fromBlock, collectedEvents.length,
      );

      return { collectedEvents, isGotAllEvents: false, lastBlockNumber: fromBlock };
    }

    return { collectedEvents, isGotAllEvents: true, lastBlockNumber };
  }
}
