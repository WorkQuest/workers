import Web3 from "web3";
import {Op} from "sequelize";
import {PensionFundEvents} from "./types";
import {EventData} from "web3-eth-contract";
import {BlocksRange} from "../../../middleware/middleware.types"
import {
  ILogger,
  IController,
  IContractProvider,
  IContractListenerProvider,
  INotificationSenderClient,
} from "../../../middleware/middleware.interfaces";
import {
  BlockchainNetworks,
  PensionFundBlockInfo,
  PensionFundWithdrewEvent,
  PensionFundReceivedEvent,
  PensionFundWalletUpdatedEvent,
} from "@workquest/database-models/lib/models";

export class PensionFundController implements IController {
  constructor(
    protected readonly web3: Web3,
    protected readonly Logger: ILogger,
    public readonly network: BlockchainNetworks,
    public readonly contractProvider: IContractProvider,
    protected readonly notificationClient: INotificationSenderClient,
  ) {
  }

  protected async onEventHandler(eventsData: EventData) {
    this.Logger.info('Event handler: name "%s", block number "%s", address "%s"',
      eventsData.event,
      eventsData.blockNumber,
      eventsData.address,
    );

    if (eventsData.event === PensionFundEvents.Received) {
      await this.receivedEventHandler(eventsData);
    } else if (eventsData.event === PensionFundEvents.Withdrew) {
      await this.withdrewEventHandler(eventsData);
    } else if (eventsData.event === PensionFundEvents.WalletUpdated) {
      await this.walletUpdatedEventHandler(eventsData);
    }
  }

  public async getLastCollectedBlock(): Promise<number> {
    const [{ lastParsedBlock }, ] = await PensionFundBlockInfo.findOrCreate({
      where: { network: this.network },
      defaults: {
        network: this.network,
        lastParsedBlock: this.contractProvider.eventViewingHeight,
      },
    });

    this.Logger.debug('Last collected block: last block "%s"', lastParsedBlock);

    return lastParsedBlock;
  }

  protected updateBlockViewHeight(blockHeight: number) {
    this.Logger.debug('Update blocks: new block height "%s"', blockHeight);

    return PensionFundBlockInfo.update({ lastParsedBlock: blockHeight }, {
      where: {
        network: this.network,
        lastParsedBlock: { [Op.lt]: blockHeight },
      },
    });
  }

  protected async receivedEventHandler(eventsData: EventData) {
    const transactionHash = eventsData.transactionHash.toLowerCase();
    const user = eventsData.returnValues.user.toLowerCase();

    this.Logger.debug(
      'Received event handler: event data %o', eventsData,
    );

    const [receivedEvent, isCreated] = await PensionFundReceivedEvent.findOrCreate({
      where: { transactionHash, network: this.network },
      defaults: {
        user,
        transactionHash,
        blockNumber: eventsData.blockNumber,
        amount: eventsData.returnValues.amount,
        event: PensionFundEvents.Received,
        network: this.network,
      },
    });

    if (!isCreated) {
      this.Logger.warn('Received event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    const { timestamp } = await this.web3.eth.getBlock(eventsData.blockNumber);

    await receivedEvent.update({ timestamp });

    await this.notificationClient.notify({
      recipients: [user],
      action: eventsData.event,
      data: eventsData
    });
  }

  protected async withdrewEventHandler(eventsData: EventData) {
    const transactionHash = eventsData.transactionHash.toLowerCase();
    const user = eventsData.returnValues.user.toLowerCase();

    this.Logger.debug(
      'Withdrew event handler: event data %o',
      eventsData,
    );

    const [fundWithdrewEvent, isCreated] = await PensionFundWithdrewEvent.findOrCreate({
      where: { transactionHash, network: this.network },
      defaults: {
        user,
        transactionHash,
        blockNumber: eventsData.blockNumber,
        amount: eventsData.returnValues.amount,
        event: PensionFundEvents.Withdrew,
        network: this.network,
      },
    });

    if (!isCreated) {
      this.Logger.warn('Withdrew event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    const { timestamp } = await this.web3.eth.getBlock(eventsData.blockNumber);

    await fundWithdrewEvent.update({ timestamp });

    await this.notificationClient.notify({
      recipients: [user],
      action: eventsData.event,
      data: eventsData
    });
  }

  protected async walletUpdatedEventHandler(eventsData: EventData) {
    const transactionHash = eventsData.transactionHash.toLowerCase();
    const user = eventsData.returnValues.user.toLowerCase();

    this.Logger.debug(
      'Wallet updated event handler: event data %o',
      eventsData,
    );

    const [walletUpdatedEvent, isCreated] = await PensionFundWalletUpdatedEvent.findOrCreate({
      where: { transactionHash, network: this.network },
      defaults: {
        user,
        transactionHash,
        blockNumber: eventsData.blockNumber,
        newFee: eventsData.returnValues.newFee,
        unlockDate: eventsData.returnValues.unlockDate,
        event: PensionFundEvents.WalletUpdated,
        network: this.network,
      },
    });

    if (!isCreated) {
      this.Logger.warn('Wallet updated event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    const { timestamp } = await this.web3.eth.getBlock(eventsData.blockNumber);

    await walletUpdatedEvent.update({ timestamp });

    await this.notificationClient.notify({
      recipients: [user],
      action: eventsData.event,
      data: eventsData
    });
  }

  public async syncBlocks(callback?: () => void) {
    const blockRange: BlocksRange = {
      to: 'latest',
      from: await this.getLastCollectedBlock(),
    }

    this.Logger.info('Start collecting all uncollected events from block number: %s.', blockRange.from);

    await this.contractProvider.getEvents(blockRange, async (receivedEvents) => {
      for (const event of receivedEvents.events) {
        try {
          await this.onEventHandler(event);
          await this.updateBlockViewHeight(event.blockNumber);
        } catch (e) {
          this.Logger.error(e, 'Event processing ended with error');

          throw e;
        }
      }

      await this.updateBlockViewHeight(receivedEvents.lastBlockNumber);

      if (receivedEvents.error) {
        throw receivedEvents.error;
      }
      if (callback) {
        callback();
      }
    });
  }

  public async start() {
  }
}

export class PensionFundListenerController extends PensionFundController {
  constructor(
    protected readonly web3: Web3,
    protected readonly Logger: ILogger,
    public readonly network: BlockchainNetworks,
    public readonly contractProvider: IContractListenerProvider,
    public readonly notificationClient: INotificationSenderClient,
  ) {
    super(web3, Logger, network, contractProvider, notificationClient);
  }

  public async start() {
    await super.start();

    this.contractProvider.startListener(
      await this.getLastCollectedBlock()
    );

    this.contractProvider.on('events', (async (eventData) => {
      await this.onEventHandler(eventData);
    }));
  }
}

export class PensionRouterController extends PensionFundListenerController {
  constructor(
    protected readonly web3: Web3,
    protected readonly Logger: ILogger,
    public readonly network: BlockchainNetworks,
    public readonly contractProvider: IContractListenerProvider,
    public readonly notificationClient: INotificationSenderClient,
  ) {
    super(web3, Logger, network, contractProvider, notificationClient);
  }
}
