import { BridgeContract, BridgeEventType } from './BridgeContract';
import { BlockchainNetworks, BridgeParserBlockInfo, BridgeSwapTokenEvent, SwapEvents } from '@workquest/database-models/lib/models';
import { BridgeMessageBroker } from './BridgeBroker';

export enum TrackedEvents {
  swapInitialized = 'SwapInitialized',
  swapRedeemed = 'SwapRedeemed',
}

abstract class BridgeListener {
  protected readonly _contract: BridgeContract;
  protected readonly _parserBlockInfo: BridgeParserBlockInfo;

  protected constructor(contract: BridgeContract, parserBlockInfo: BridgeParserBlockInfo) {
    this._contract = contract;
    this._parserBlockInfo = parserBlockInfo;

    this._contract.signCallbackOnEvent((eventData) => this._onEvent(eventData));
  }

  protected abstract _parseSwapInitializedEvent(data: any): Promise<void>;
  protected abstract _parseSwapRedeemedEvent(data: any): Promise<void>;

  public async preParseSwaps() {
    for await (const events of this._contract.preParsingEvents()) {
      for (const event of events) await this._onEvent(event);
    }
  }

  protected async _onEvent(event: BridgeEventType): Promise<void> {
    if (event.event === TrackedEvents.swapInitialized) {
      await this._parseSwapInitializedEvent(event);
      BridgeMessageBroker.sendBridgeNotification(event);
    } else if (event.event === TrackedEvents.swapRedeemed) {
      await this._parseSwapRedeemedEvent(event);
      BridgeMessageBroker.sendBridgeNotification(event);
    }

    this._parserBlockInfo.lastParsedBlock = event.blockNumber;

    await this._parserBlockInfo.save();
  }

  start(): Promise<void> {
    return this._contract.startListener();
  }
}

export class BridgeBscListener extends BridgeListener {
  constructor(contract: BridgeContract, parserBlockInfo: BridgeParserBlockInfo) {
    super(contract, parserBlockInfo);
  }

  protected async _parseSwapInitializedEvent(event: BridgeEventType): Promise<void> {
    const [swappedEvent, _] = await BridgeSwapTokenEvent.findOrCreate({
      where: {
        transactionHash: event.transactionHash,
        network: BlockchainNetworks.bscMainNetwork, // TODO
      },
      defaults: {
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        network: BlockchainNetworks.bscMainNetwork, // TODO
        event: SwapEvents.swapInitialized,
        messageHash: event.messageHash,
        nonce: event.nonce,
        timestamp: event.timestamp,
        initiator: event.sender.toLowerCase(),
        recipient: event.recipient.toLowerCase(),
        amount: event.amount,
        chainTo: event.chainTo,
        chainFrom: event.chainFrom,
        symbol: event.symbol,
      },
    });
  }

  protected async _parseSwapRedeemedEvent(event: BridgeEventType): Promise<void> {
    await BridgeSwapTokenEvent.findOrCreate({
      where: {
        transactionHash: event.transactionHash,
        network: BlockchainNetworks.bscMainNetwork, // TODO
      },
      defaults: {
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        network: BlockchainNetworks.bscMainNetwork, // TODO
        event: SwapEvents.swapRedeemed,
        messageHash: event.messageHash,
        nonce: event.nonce,
        timestamp: event.timestamp,
        initiator: event.sender.toLowerCase(),
        recipient: event.recipient.toLowerCase(),
        amount: event.amount,
        chainTo: event.chainTo,
        chainFrom: event.chainFrom,
        symbol: event.symbol,
      },
    });
  }
}

export class BridgeEthListener extends BridgeListener {
  constructor(contract: BridgeContract, parserBlockInfo: BridgeParserBlockInfo) {
    super(contract, parserBlockInfo);
  }

  protected async _parseSwapInitializedEvent(event: BridgeEventType): Promise<void> {
    await BridgeSwapTokenEvent.findOrCreate({
      where: {
        transactionHash: event.transactionHash,
        network: BlockchainNetworks.ethMainNetwork, // TODO
      },
      defaults: {
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        network: BlockchainNetworks.ethMainNetwork, // TODO
        event: SwapEvents.swapInitialized,
        messageHash: event.messageHash,
        nonce: event.nonce,
        timestamp: event.timestamp,
        initiator: event.sender.toLowerCase(),
        recipient: event.recipient.toLowerCase(),
        amount: event.amount,
        chainTo: event.chainTo,
        chainFrom: event.chainFrom,
        symbol: event.symbol,
      },
    });
  }

  protected async _parseSwapRedeemedEvent(event: BridgeEventType): Promise<void> {
    await BridgeSwapTokenEvent.findOrCreate({
      where: {
        transactionHash: event.transactionHash,
        network: BlockchainNetworks.ethMainNetwork, // TODO
      },
      defaults: {
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        network: BlockchainNetworks.ethMainNetwork, // TODO
        event: SwapEvents.swapRedeemed,
        messageHash: event.messageHash,
        nonce: event.nonce,
        timestamp: event.timestamp,
        initiator: event.sender.toLowerCase(),
        recipient: event.recipient.toLowerCase(),
        amount: event.amount,
        chainTo: event.chainTo,
        chainFrom: event.chainFrom,
        symbol: event.symbol,
      },
    });
  }
}
