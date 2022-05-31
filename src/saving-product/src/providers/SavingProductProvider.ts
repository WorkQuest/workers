import { Transaction } from "web3-eth";
import { Logger } from "../../logger/pino";
import { Contract, EventData } from "web3-eth-contract";
import { onEventCallBack, IContractProvider, SavingProductClients } from "./types";
import { Networks, Store, WorkQuestNetworkContracts } from "@workquest/contract-data-pools";

export class SavingProductProvider implements IContractProvider {
  private readonly onEventCallBacks: onEventCallBack[] = [];

  private readonly preParsingSteps = 6000;

  constructor (
    public readonly clients: SavingProductClients,
    public readonly contract: Contract,
  ) {};

  private async initBrokerListener() {
    await this.clients.transactionsBroker.initConsumer(this.onEventFromBroker.bind(this));
  }

  private async onEventFromBroker(payload: { transactions: Transaction[] }) {
    const contractData = Store[Networks.WorkQuest][WorkQuestNetworkContracts.SavingProduct];

    const tracedTxs = payload
      .transactions
      .filter(tx => tx.to && tx.to.toLowerCase() === contractData.address.toLowerCase())
      .sort((a, b) => a.blockNumber = b.blockNumber);

    if (tracedTxs.length === 0) {
      return;
    }

    const eventsData = await this.contract.getPastEvents('allEvents', {
      toBlock: tracedTxs[tracedTxs.length - 1].blockNumber,
      fromBlock: tracedTxs[0].blockNumber,
    });

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
    await this.initBrokerListener();

    Logger.info('Start listener on contract: "%s"', this.contract.options.address);
  }

  public subscribeOnEvents(onEventCallBack: onEventCallBack): void {
    this.onEventCallBacks.push(onEventCallBack);
  }

  public async getAllEvents(fromBlockNumber: number) {
    const collectedEvents: EventData[] = [];
    const lastBlockNumber = await this.clients.web3.eth.getBlockNumber();

    Logger.info('Start collecting all uncollected events from block number: "%s", last block number "%s"',
      fromBlockNumber,
      lastBlockNumber,
    );

    let fromBlock = fromBlockNumber;
    let toBlock = fromBlock + this.preParsingSteps;

    try {
      while (true) {
        if (toBlock >= lastBlockNumber) {
          Logger.info('Getting events in a range: from "%s", to "%s"', fromBlock, lastBlockNumber);

          const eventsData = await this.contract.getPastEvents('allEvents', { fromBlock, toBlock: lastBlockNumber });

          collectedEvents.push(...eventsData);

          Logger.info('Collected events per range: "%s". Collected events: "%s"', eventsData.length, collectedEvents.length);

          break;
        }

        Logger.info('Getting events in a range: from "%s", to "%s"', fromBlock, toBlock);

        const eventsData = await this.contract.getPastEvents('allEvents', { fromBlock, toBlock });


        collectedEvents.push(...eventsData);

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
