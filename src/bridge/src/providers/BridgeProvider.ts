import {onEventCallBack} from "./types";
import {Contract, EventData} from "web3-eth-contract";
import {BridgeClients, IContractProvider} from "./types";

export class BridgeProvider implements IContractProvider {

  private readonly onEventCallBacks: onEventCallBack[] = [];

  private readonly preParsingSteps = 6000;

  constructor(
    public readonly clients: BridgeClients,
    public readonly contract: Contract,
  ) {}

  private contractEventsListenerInit() {
    this.contract.events
      .allEvents({ fromBlock: "latest" })
      .on('error', console.error)
      .on('data', async (eventData) => await this.onEventData(eventData));
  }

  private onEventData(eventData) {
    return Promise.all(
      this.onEventCallBacks.map(async (callBack) => {
        return callBack(eventData);
      }),
    );
  }

  public startListener() {
    this.contractEventsListenerInit();
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
          console.info('Block from: ', fromBlock, ' block to: ', toBlock);

          const eventsData = await this.contract.getPastEvents('allEvents', { fromBlock, toBlock: lastBlockNumber });

          if (eventsData !== undefined) {
            collectedEvents.push(...eventsData); break;
          }
        }

        console.info('Block from: ', fromBlock, ' block to: ', toBlock);

        const eventsData = await this.contract.getPastEvents('allEvents', { fromBlock, toBlock });

        if (eventsData !== undefined) {
          collectedEvents.push(...eventsData);
        }

        fromBlock += this.preParsingSteps;
        toBlock = fromBlock + this.preParsingSteps - 1;
      }
    } catch (error) {
      console.error(error);
      console.error('GetAllEvents: Last block: ', fromBlock);

      return { collectedEvents, error, lastBlockNumber: fromBlock };
    }

    return { collectedEvents, lastBlockNumber };
  }
}
