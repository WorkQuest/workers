import Web3 from "web3";
import EventEmitter from "events";
import {Contract} from "web3-eth-contract";
import {ILogger} from "../logging/logging.interfaces";
import {ContractRpcProvider} from "./ContractRpcProvider";
import {ContractRpcProviderOptions} from "./contract-providers.types";
import {IContractListenerProvider} from "./contract-providers.interfaces";

export class ContractWsProvider extends ContractRpcProvider implements IContractListenerProvider {
  private readonly eventEmitter: EventEmitter;

  constructor(
    public readonly address: string,
    public readonly eventViewingHeight: number,
    protected readonly web3: Web3,
    public readonly contract: Contract,
    protected readonly Logger: ILogger,
    protected readonly options: ContractRpcProviderOptions,
  ) {
    super(address, eventViewingHeight, web3, contract, Logger, options);

    this.eventEmitter = new EventEmitter();
  }

  private onErrorHandler(error) {
    this.eventEmitter.emit('error', error);
  }

  private onEventDataHandler(eventData) {
    this.eventEmitter.emit('events', eventData);
  }

  public startListener(fromBlockNumber?: number) {
    this.contract.events
      .allEvents({ fromBlock: fromBlockNumber || "latest" })
      .on('error', (error) => this.onErrorHandler(error))
      .on('data', (eventData) => this.onEventDataHandler(eventData))

    this.Logger.info('Start listener on contract: "%s"', this.contract.options.address);
  }

  public on(type, callBack): void {
    if (type === 'error') {
      this.eventEmitter.addListener('error', callBack);
    } else if (type === 'events') {
      this.eventEmitter.addListener('events', callBack);
    }
  }

  public isListening(): Promise<boolean> {
    return this.web3.eth.net.isListening();
  }
}
