import Web3 from "web3";
import {Op} from "sequelize";
import {EventData} from "web3-eth-contract";
import {IController, BridgeEvents} from "./types";
import configBridge from "../../config/config.bridge";
import {INotificationClient} from "../../../middleware";
import {IContractListenerProvider} from "../../../types";
import {IContractProvider, ILogger} from "../../../types";
import {
  BlockchainNetworks,
  BridgeSwapTokenEvent,
  BridgeParserBlockInfo,
} from "@workquest/database-models/lib/models";

export class BridgeController implements IController {
  constructor(
    protected readonly web3: Web3,
    protected readonly Logger: ILogger,
    public readonly network: BlockchainNetworks,
    public readonly contractProvider: IContractProvider,
    protected readonly notificationClient: INotificationClient,
  ) {
  }

  protected async onEvent(eventsData: EventData) {
    this.Logger.info('Event handler: name "%s", block number "%s", address "%s"',
      eventsData.event,
      eventsData.blockNumber,
      eventsData.address,
    );

    if (eventsData.event === BridgeEvents.SwapRedeemed) {
      return this.swapRedeemedEventHandler(eventsData);
    } else if (eventsData.event === BridgeEvents.SwapInitialized) {
      return this.swapInitializedEventHandler(eventsData);
    }
  }

  public async getLastCollectedBlock(): Promise<number> {
    const [{ lastParsedBlock }, ] = await BridgeParserBlockInfo.findOrCreate({
      where: { network: this.network },
      defaults: {
        network: this.network,
        lastParsedBlock: this.contractProvider.eventViewingHeight,
      },
    });

    this.Logger.debug('Last collected block "%s"', lastParsedBlock);

    return lastParsedBlock;
  }

  protected updateBlockViewHeight(blockHeight: number) {
    this.Logger.debug('Update blocks: new block height "%s"', blockHeight);

    return BridgeParserBlockInfo.update({ lastParsedBlock: blockHeight }, {
      where: {
        network: this.network,
        lastParsedBlock: { [Op.lt]: blockHeight },
      }
    });
  }

  public async swapRedeemedEventHandler(eventsData: EventData) {
    const transactionHash = eventsData.transactionHash.toLowerCase();
    const initiator = eventsData.returnValues.sender.toLowerCase();
    const recipient = eventsData.returnValues.recipient.toLowerCase();

    this.Logger.debug(
      'Swap redeemed event handler: timestamp "%s", event data %o',
      eventsData.returnValues.timestamp,
      eventsData,
    );

    /** Не трогать последовательность */
    const messageHash = this.web3.eth.accounts.sign(Web3.utils.soliditySha3(
      eventsData.returnValues.nonce,
      eventsData.returnValues.amount,
      eventsData.returnValues.recipient,
      eventsData.returnValues.sender,
      eventsData.returnValues.chainFrom,
      eventsData.returnValues.chainTo,
      eventsData.returnValues.symbol,
    ), configBridge.privateKey).message;

    const [, isCreated] = await BridgeSwapTokenEvent.findOrCreate({
      where: { transactionHash, network: this.network },
      defaults: {
        initiator,
        recipient,
        messageHash,
        transactionHash,
        network: this.network,
        event: BridgeEvents.SwapRedeemed,
        blockNumber: eventsData.blockNumber,
        nonce: eventsData.returnValues.nonce,
        symbol: eventsData.returnValues.symbol,
        amount: eventsData.returnValues.amount,
        chainTo: eventsData.returnValues.chainTo,
        timestamp: eventsData.returnValues.timestamp,
        chainFrom: eventsData.returnValues.chainFrom,
      }
    });

    if (!isCreated) {
      this.Logger.warn('Swap redeemed event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    await this.notificationClient.notify({
      recipients: [recipient],
      action: BridgeEvents.SwapRedeemed,
      data: eventsData
    });
  }

  public async swapInitializedEventHandler(eventsData: EventData) {
    const transactionHash = eventsData.transactionHash.toLowerCase();
    const initiator = eventsData.returnValues.sender.toLowerCase();
    const recipient = eventsData.returnValues.recipient.toLowerCase();

    this.Logger.debug(
      'Swap initialized event handler: timestamp "%s", event data %o',
      eventsData.returnValues.timestamp, eventsData
    );

    /** Не трогать последовательность */
    const messageHash = this.web3.eth.accounts.sign(Web3.utils.soliditySha3(
      eventsData.returnValues.nonce,
      eventsData.returnValues.amount,
      eventsData.returnValues.recipient,
      eventsData.returnValues.sender,
      eventsData.returnValues.chainFrom,
      eventsData.returnValues.chainTo,
      eventsData.returnValues.symbol,
    ), configBridge.privateKey).message;

    const [_, isCreated] = await BridgeSwapTokenEvent.findOrCreate({
      where: { transactionHash, network: this.network },
      defaults: {
        initiator,
        recipient,
        messageHash,
        transactionHash,
        network: this.network,
        event: BridgeEvents.SwapInitialized,
        blockNumber: eventsData.blockNumber,
        nonce: eventsData.returnValues.nonce,
        symbol: eventsData.returnValues.symbol,
        amount: eventsData.returnValues.amount,
        chainTo: eventsData.returnValues.chainTo,
        timestamp: eventsData.returnValues.timestamp,
        chainFrom: eventsData.returnValues.chainFrom,
      }
    });

    if (!isCreated) {
      this.Logger.warn('Swap initialized event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    /** Не трогать последовательность */
    const sign = await this.web3.eth.accounts.sign(this.web3.utils.soliditySha3(
      eventsData.returnValues.nonce,
      eventsData.returnValues.amount,
      recipient,
      eventsData.returnValues.chainFrom,
      eventsData.returnValues.chainTo,
      eventsData.returnValues.symbol,
    ), configBridge.privateKey);

    /** Не трогать последовательность! Метод redeem на контракте */
    eventsData['signData'] = [
      eventsData.returnValues.nonce.toString(),
      eventsData.returnValues.chainFrom.toString(),
      eventsData.returnValues.amount,
      recipient,
      sign.v,
      sign.r,
      sign.s,
      eventsData.returnValues.symbol,
    ]

    await this.notificationClient.notify({
      recipients: [recipient],
      action: BridgeEvents.SwapInitialized,
      data: eventsData
    });
  }

  protected async syncOfViewedBlocks(fromBlockNumber: number) {
    this.Logger.info('Start collecting all uncollected events from block number: %s.', fromBlockNumber);

    const { events, error, lastBlockNumber } = await this.contractProvider.getEvents(fromBlockNumber);

    for (const event of events) {
      try {
        await this.onEvent(event);
        await this.updateBlockViewHeight(event.blockNumber);
      } catch (e) {
        this.Logger.error(e, 'Event processing ended with error');

        throw e;
      }
    }

    await this.updateBlockViewHeight(lastBlockNumber);

    if (error) {
      throw error;
    }
  };

  public async syncBlocks() {
    const lastParsedBlock = await this.getLastCollectedBlock();

    await this.syncOfViewedBlocks(lastParsedBlock);
  }

  public async start() {
    await this.syncOfViewedBlocks(
      await this.getLastCollectedBlock()
    );
  }
}

export class BridgeListenerController extends BridgeController {
  constructor(
    public readonly web3: Web3,
    protected readonly Logger: ILogger,
    public readonly network: BlockchainNetworks,
    public readonly contractProvider: IContractListenerProvider,
    public readonly notificationClient: INotificationClient,
  ) {
    super(web3, Logger, network, contractProvider, notificationClient);
  }

  public async start() {
    await super.start();

    this.contractProvider.startListener(
      await this.getLastCollectedBlock()
    );

    this.contractProvider.on('events', (async (eventData) => {
      await this.onEvent(eventData);
    }));
  }
}

export class BridgeRouterController extends BridgeListenerController {
  private _latchSyncOfViewedBlocks  = false;

  private isBlockedSyncOfViewedBlocks() { return this._latchSyncOfViewedBlocks }
  private blockSyncOfViewedBlocks() { this._latchSyncOfViewedBlocks = true }
  private unblockSyncOfViewedBlocks() { this._latchSyncOfViewedBlocks = false }

  constructor(
    public readonly web3: Web3,
    protected readonly Logger: ILogger,
    public readonly network: BlockchainNetworks,
    public readonly contractProvider: IContractListenerProvider,
    public readonly notificationClient: INotificationClient,
  ) {
    super(web3, Logger, network, contractProvider, notificationClient);
  }

  public async syncBlocks() {
    if (!this.isBlockedSyncOfViewedBlocks()) {
      this.blockSyncOfViewedBlocks();

      await super.syncBlocks();

      this.unblockSyncOfViewedBlocks();
    }
  }
}
