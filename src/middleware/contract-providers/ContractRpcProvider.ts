import {ContractRpcProviderSettings} from "./contract-providers.types";
import Web3 from "web3";
import {Contract, EventData} from "web3-eth-contract";
import {ILogger} from "../logging/logging.interfaces";
import {IContractProvider} from "./contract-providers.interfaces";

export class ContractRpcProvider implements IContractProvider {
  protected readonly settings: ContractRpcProviderSettings;

  constructor(
    public readonly address: string,
    public readonly eventViewingHeight: number,
    protected readonly web3: Web3,
    public readonly contract: Contract,
    protected readonly Logger: ILogger,
  ) {
    this.settings = { blockAssembler: { steps: 2000 } }
  }

  public async getEvents(fromBlockNumber: number) {
    const { steps } = this.settings.blockAssembler;
    const collectedEvents: EventData[] = [];
    const lastBlockNumber = await this.web3.eth.getBlockNumber();

    let fromBlock = fromBlockNumber;
    let toBlock = fromBlock + steps;

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

        fromBlock += steps;
        toBlock = fromBlock + steps - 1;
      }
    } catch (error) {
      this.Logger.error(error, 'Collection of all events ended with an error.' +
        ' Collected events to block number: "%s". Total collected events',
        fromBlock, collectedEvents.length,
      );

      return { events: collectedEvents, error, lastBlockNumber: fromBlock };
    }

    return { events: collectedEvents, lastBlockNumber };
  }
}
