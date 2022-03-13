import Web3 from 'web3';
import { Contract, EventData } from 'web3-eth-contract';
import { WebsocketClient as TendermintWebsocketClient } from "@cosmjs/tendermint-rpc";
import { onEventCallBack, Web3Provider } from './types';
import configPensionFund from "../../config/config.pensionFund";

export class PensionFundProvider implements Web3Provider {
  private readonly onEventCallBacks: onEventCallBack[] = [];

  private readonly preParsingSteps = 6000;

  constructor(
    public readonly web3: Web3,
    private readonly tendermintWs: TendermintWebsocketClient,
    public readonly contract: Contract,
  ) {}

  private contractTransactionsListenerInit() {
    // TODO WHYYYYY???? ${configPensionFund.contractAddress} NOT WORKING!!!!!
    const query = `tm.event='Tx' AND ethereum_tx.recipient='0xfaC60Ac942b8Ac6a2BC2470D81124C34e8719d88'`;

    const stream = this.tendermintWs.listen({
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
    const lastBlockNumber = await this.web3.eth.getBlockNumber();

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