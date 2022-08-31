import Web3 from "web3";
import {Contract, EventData} from "web3-eth-contract";
import {ILogger} from "../logging/logging.interfaces";
import {IContractProvider} from "./contract-providers.interfaces";
import {ContractRpcProviderOptions, ReceivedEvents} from "./contract-providers.types";
import {BlocksRange} from "../utilis/utilits.types";

export class ContractRpcProvider implements IContractProvider {
  constructor(
    public readonly address: string,
    public readonly eventViewingHeight: number,
    protected readonly web3: Web3,
    public readonly contract: Contract,
    protected readonly Logger: ILogger,
    protected readonly options: ContractRpcProviderOptions,
  ) {
  }

  public async getEvents(blocksRange: BlocksRange, callback: (events: ReceivedEvents) => void) {
    const { stepsRange } = this.options;
    const collectedEvents: EventData[] = [];

    const lastBlockNumber = blocksRange.to === 'latest'
      ? await this.web3.eth.getBlockNumber()
      : blocksRange.to

    let fromBlock = blocksRange.from;
    let toBlock = fromBlock + stepsRange;

    try {
      while (true) {
        if (toBlock >= lastBlockNumber) {
          this.Logger.info('Getting events in a range: from "%s", to "%s"', fromBlock, lastBlockNumber);

          const eventsData = await this.contract.getPastEvents('allEvents', { fromBlock, toBlock: lastBlockNumber });

          collectedEvents.push(...eventsData);

          this.Logger.info('Collected events per range: "%s". Collected events: "%s". Left to collect blocks "%s"',
            eventsData.length,
            collectedEvents.length,
            lastBlockNumber - toBlock,
          );

          break;
        }

        this.Logger.info('Getting events in a range: from "%s", to "%s"', fromBlock, toBlock);

        const eventsData = await this.contract.getPastEvents('allEvents', { fromBlock, toBlock });

        collectedEvents.push(...eventsData);

        this.Logger.info('Collected events per range: "%s". Collected events: "%s"', eventsData.length, collectedEvents.length);

        fromBlock += stepsRange;
        toBlock = fromBlock + stepsRange - 1;
      }
    } catch (error) {
      this.Logger.error(error, 'Collection of all events ended with an error.' +
        ' Collected events to block number: "%s". Total collected events',
        fromBlock, collectedEvents.length,
      );

      callback({ events: collectedEvents, error, lastBlockNumber: fromBlock });
    }

    callback({ events: collectedEvents, lastBlockNumber });
  }
}
