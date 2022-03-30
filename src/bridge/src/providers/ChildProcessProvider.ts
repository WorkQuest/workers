import { Contract, EventData } from "web3-eth-contract";
import { onEventCallBack, IContractProvider, BridgeClients } from "./types";

export class ChildProcessProvider implements IContractProvider {
  private readonly onEventCallBacks: onEventCallBack[] = [];

  private readonly preParsingSteps = 6000;

  constructor (
    public readonly clients: BridgeClients,
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

      return { collectedEvents, error, lastBlockNumber: fromBlock };
    }

    return { collectedEvents, lastBlockNumber };
  }
}
