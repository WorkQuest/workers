import {onEventCallBack} from "./types";
import {Clients, IContractProvider} from "./types";
import {Contract, EventData} from "web3-eth-contract";

export class BridgeProvider implements IContractProvider {

  private readonly onEventCallBacks: onEventCallBack[] = [];

  private readonly preParsingSteps = 6000;

  constructor(
    public readonly clients: Clients,
    public readonly contract: Contract,
  ) {}

  private contractTransactionsListenerInit() {
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
    const blockTxHeight = txData["data"]["value"]['TxResult']["height"] as string;
    const eventsData = await this.contract.getPastEvents('allEvents', { fromBlock: blockTxHeight, toBlock: blockTxHeight });

    /** See range (fromBlock: blockTxHeight, toBlock: blockTxHeight) */
    await this.onEventData(eventsData[0]);
  }

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
    if (this.clients.tendermintWsClient) {
      this.contractTransactionsListenerInit();
    } else {
      this.contractEventsListenerInit();
    }
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

          collectedEvents.push(...eventsData); break;
        }

        console.info('Block from: ', fromBlock, ' block to: ', toBlock);

        const eventsData = await this.contract.getPastEvents('allEvents', { fromBlock, toBlock });

        collectedEvents.push(...eventsData);

        fromBlock += this.preParsingSteps;
        toBlock = fromBlock + this.preParsingSteps - 1;
      }
    } catch (error) {
      console.error(error);
      console.error('GetAllEvents: Last block: ', collectedEvents[collectedEvents.length - 1].blockNumber);

      return { collectedEvents, isGotAllEvents: false, lastBlockNumber: collectedEvents[collectedEvents.length - 1].blockNumber };
    }

    return { collectedEvents, isGotAllEvents: true, lastBlockNumber };
  }
}
