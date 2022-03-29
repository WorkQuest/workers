import { Contract, EventData } from 'web3-eth-contract';
import {onEventCallBack, IContractProvider, QuestFactoryClients} from './types';

export class QuestFactoryProvider implements IContractProvider {
  private readonly onEventCallBacks: onEventCallBack[] = [];

  private readonly preParsingSteps = 6000;

  constructor(
    public readonly clients: QuestFactoryClients,
    public readonly contract: Contract,
  ) {}

  private contractTransactionsListenerInit() {
    // TODO WHYYYYY???? ${configPensionFund.contractAddress} NOT WORKING!!!!!
    const query = `tm.event='Tx' AND ethereum_tx.recipient='0xF38E33e7DD7e1a91c772aF51A366cd126e4552BB'`;

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

  private async onEventData(eventData) {
    return Promise.all(
      this.onEventCallBacks.map(async callBack => callBack(eventData))
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