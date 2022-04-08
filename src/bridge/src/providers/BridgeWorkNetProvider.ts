import {onEventCallBack} from "./types";
import {Clients, IContractProvider} from "./types";
import {Contract, EventData} from "web3-eth-contract";
import { Logger } from "../../logger/pino";

export class BridgeWorkNetProvider implements IContractProvider {

  private readonly onEventCallBacks: onEventCallBack[] = [];

  private readonly preParsingSteps = 6000;

  constructor(
    public readonly clients: Clients,
    public readonly contract: Contract,
  ) {
  }

  private contractTransactionsListenerInit() {
    // TODO WHYYYYY????  NOT WORKING!!!!!
    const query = `tm.event='Tx' AND ethereum_tx.recipient='0x841e6d5991F67D8c9F88a6F9726246774a4ab376'`;

    const stream = this.clients.tendermintWsClient.listen({
      id: 0,
      jsonrpc: '2.0',
      method: 'subscribe',
      params: { query },
    });

    stream.addListener({
      next: data => this.onEventTendermintData(data),
      error: err => console.error(err),
      complete: () => console.log('completed'),
    });
  }

  private async onEventTendermintData(txData) {
    console.log(txData);
    const blockTxHeight = txData["data"]["value"]['TxResult']["height"] as string;
    const eventsData = await this.contract.getPastEvents('allEvents', { fromBlock: blockTxHeight, toBlock: blockTxHeight });

    await this.onEventData(eventsData[0]);
  }

  private onEventData(eventData) {
    return Promise.all(
      this.onEventCallBacks.map(async (callBack) => {
        return callBack(eventData);
      }),
    );
  }

  public startListener() {
    this.contractTransactionsListenerInit();
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
