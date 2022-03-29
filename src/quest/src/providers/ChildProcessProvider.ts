import fs from "fs";
import path from "path";
import { EventData } from "web3-eth-contract";
import { onEventCallBack, IContractProvider, QuestClients } from "./types";

const abiFilePath = path.join(__dirname, '/../../abi/WorkQuest.json');
const abi: any[] = JSON.parse(fs.readFileSync(abiFilePath).toString()).abi;

export class ChildProcessProvider implements IContractProvider {
  private readonly onEventCallBacks: onEventCallBack[] = [];

  private readonly preParsingSteps = 100;

  constructor (
    public readonly clients: QuestClients,
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

  private async onEventFromFatherProcess(payload: { toBlock: number, fromBlock: number, contractAddress: string }) {
    const contract = new this.clients.web3.eth.Contract(abi, payload.contractAddress);
    const eventsData = await contract.getPastEvents('allEvents', payload);

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

          const blocks = await Promise.all(
            [...Array(lastBlockNumber - fromBlock).keys()]
              .map(i => i + fromBlock + 1)
              .map(async bn => this.clients.web3.eth.getBlock(bn, true))
          );

          const txs = blocks
            .map(block => block.transactions)
            .reduce((prev, current) => [...prev, ...current]);

          const tracedTxs = txs
            .filter(async tx => tx.to && await this.clients.questCacheProvider.get(tx.to.toLowerCase()))

          if (tracedTxs.length !== 0) {
            for (const tx of tracedTxs) {
              const contract = new this.clients.web3.eth.Contract(abi, tx.to);
              const eventsData = await contract.getPastEvents('allEvents', { fromBlock, toBlock: lastBlockNumber });

              collectedEvents.push(...eventsData);
            }
          }

          break;
        }

        console.info('Block from: ', fromBlock, ' block to: ', toBlock);

        const blocks = await Promise.all(
          [...Array(toBlock - fromBlock).keys()]
            .map(i => i + fromBlock + 1)
            .map(async bn => this.clients.web3.eth.getBlock(bn, true))
        );

        const txs = blocks
          .map(block => block.transactions)
          .reduce((prev, current) => [...prev, ...current]);

        const tracedTxs = txs
          .filter(async tx => tx.to && await this.clients.questCacheProvider.get(tx.to.toLowerCase()))

        if (tracedTxs.length !== 0) {
          for (const tx of tracedTxs) {
            const contract = new this.clients.web3.eth.Contract(abi, tx.to);
            const eventsData = await contract.getPastEvents('allEvents', { fromBlock, toBlock });

            collectedEvents.push(...eventsData);
          }
        }

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
