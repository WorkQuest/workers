import { Contract, EventData } from "web3-eth-contract";
import { onEventCallBack, IContractProvider, Clients } from "./types";
import { Transaction } from "web3-eth";
import configProposal from "../../config/config.proposal";

export class ProposalBrokerProvider implements IContractProvider {
  private readonly onEventCallBacks: onEventCallBack[] = [];

  private readonly preParsingSteps = 6000;

  constructor (
    public readonly clients: Clients,
    public readonly contract: Contract,
  ) {};

  private async initBrokerListener() {
    await this.clients.transactionsBroker.initConsumer(this.onEventFromBroker.bind(this));
  }

  private async onEventFromBroker(payload: { transactions: Transaction[] }) {
    const proposalAddress = configProposal
      .defaultConfigNetwork()
      .contractAddress
      .toLowerCase();

    const tracedTxs = payload
      .transactions
      .filter(tx => tx.to && tx.to.toLowerCase() === proposalAddress)
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
