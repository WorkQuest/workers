import Web3 from "web3";
import {Contract, EventData} from "web3-eth-contract";
import {IContractListenerProvider, IContractProvider, ILogger} from "./types";

export class BridgeUsdtProvider implements IContractProvider {
  private readonly preParsingSteps = 6000;

  constructor(
    public readonly address: string,
    public readonly eventViewingHeight: number,
    public readonly contract: Contract,
    protected readonly web3: Web3,
    protected readonly Logger: ILogger,
  ) {
  }

  public async getEvents(fromBlockNumber: number) {
    const collectedEvents: EventData[] = [];
    const lastBlockNumber = await this.web3.eth.getBlockNumber();

    let fromBlock = fromBlockNumber;
    let toBlock = fromBlock + this.preParsingSteps;

    try {
      while (true) {
        if (toBlock >= lastBlockNumber) {
          this.Logger.info('Getting events in a range: from "%s", to "%s"', fromBlock, lastBlockNumber);

          const eventsData = await this.contract.getPastEvents('allEvents', { fromBlock, toBlock: lastBlockNumber });

          if (eventsData !== undefined) {
            collectedEvents.push(...eventsData);

            this.Logger.info('Collected events per range: "%s". Collected events: "%s"', eventsData.length, collectedEvents.length);

            break;
          }
        }

        this.Logger.info('Getting events in a range: from "%s", to "%s"', fromBlock, toBlock);

        const eventsData = await this.contract.getPastEvents('allEvents', { fromBlock, toBlock });

        if (eventsData !== undefined) {
          collectedEvents.push(...eventsData);
        }

        this.Logger.info('Collected events per range: "%s". Collected events: "%s". Left to collect blocks "%s"',
          eventsData.length,
          collectedEvents.length,
          lastBlockNumber - toBlock,
        );

        fromBlock += this.preParsingSteps;
        toBlock = fromBlock + this.preParsingSteps - 1;
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

export class BridgeUsdtWsProvider extends BridgeUsdtProvider implements IContractListenerProvider {
  private readonly callbacks = { 'events': [], 'error': [] };

  constructor(
    public readonly address: string,
    public readonly eventViewingHeight: number,
    public readonly contract: Contract,
    protected readonly web3: Web3,
    protected readonly Logger: ILogger,
  ) {
    super(address, eventViewingHeight, contract, web3, Logger);
  }

  private onError(error) {
    return Promise.all(
      this.callbacks['error'].map(async (callBack) => {
        return callBack(error);
      }),
    );
  }

  private onEventData(eventData) {
    return Promise.all(
      this.callbacks['events'].map(async (callBack) => {
        return callBack(eventData);
      }),
    );
  }

  public startListener(fromBlockNumber?: number) {
    this.contract.events
      .allEvents({ fromBlock: fromBlockNumber || "latest" })
      .on('error', (error) => this.onError(error))
      .on('data', async (eventData) => await this.onEventData(eventData))

    this.Logger.info('Start bridge listener on contract: "%s"', this.contract.options.address);
  }

  public on(type, callBack): void {
    if (type === 'error') {
      this.callbacks['error'].push(callBack);
    } else if (type === 'events') {
      this.callbacks['events'].push(callBack);
    }
  }

  public isListening(): Promise<boolean> {
    return this.web3.eth.net.isListening();
  }
}
