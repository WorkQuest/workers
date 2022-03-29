import { Contract, EventData } from 'web3-eth-contract';
import { PensionFundClients, IContractProvider, onEventCallBack } from './types';

export class PensionFundProvider implements IContractProvider {
  private readonly onEventCallBacks: onEventCallBack[] = [];

  private readonly preParsingSteps = 6000;

  constructor(
    public readonly clients: PensionFundClients,
    public readonly contract: Contract,
  ) {}

  private contractTransactionsListenerInit() {
    // TODO WHYYYYY???? ${configPensionFund.contractAddress} NOT WORKING!!!!!
    const query = `tm.event='Tx' AND ethereum_tx.recipient='0xfaC60Ac942b8Ac6a2BC2470D81124C34e8719d88'`;

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

    for (const eventData of eventsData) { await this.onEventData(eventData) }
  }

  private onEventData(eventData) {
    this.onEventCallBacks.forEach((callBack) => callBack(eventData));
  }

  public async startListener(): Promise<void> {
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
      console.error('GetAllEvents: Last block: ', fromBlock);

      return { collectedEvents, isGotAllEvents: false, lastBlockNumber: fromBlock };
    }

    return { collectedEvents, isGotAllEvents: true, lastBlockNumber };
  }
}