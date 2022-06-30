import { Logger } from "../../logger/pino";
import { Contract, EventData } from "web3-eth-contract";
import { SwapUsdtClients, IContractProvider, onEventCallBack } from "./types";
import {WebsocketProvider} from "web3-core";

export class SwapUsdtProvider implements IContractProvider {

  private readonly onEventCallBacks: onEventCallBack[] = [];

  private readonly preParsingSteps = 6000;

  constructor(
    public readonly clients: SwapUsdtClients,
    public readonly contract: Contract,
  ) {}

  private contractEventsListenerInit() {
    this.contract.events
      .allEvents({ fromBlock: "latest" })
      .on('error', (error) => { throw error })
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

    if (this.clients.web3.currentProvider instanceof WebsocketProvider) {
      this.clients.web3.currentProvider.on('end', () => Logger.error('WS provider the end'))
      this.clients.web3.currentProvider.on('error', () => Logger.error('WS provider the error'))
    }

    Logger.info('Start bridge listener on contract: "%s"', this.contract.options.address);
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

            break;
          }
        }

        Logger.info('Getting events in a range: from "%s", to "%s"', fromBlock, toBlock);

        const eventsData = await this.contract.getPastEvents('allEvents', { fromBlock, toBlock });

        if (eventsData !== undefined) {
          collectedEvents.push(...eventsData);
        }

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

      return { collectedEvents, error, lastBlockNumber: fromBlock };
    }

    return { collectedEvents, lastBlockNumber };
  }
}
