import Web3 from "web3";
import {Op} from "sequelize";
import {EventData} from "web3-eth-contract";
import {
  ILogger,
  IController,
  TrackedEvents,
  IContractProvider,
  IContractListenerProvider,
} from "./types";
import {
  BlockchainNetworks,
  SavingProductParseBlock,
  SavingProductClaimedEvent,
  SavingProductBorrowedEvent,
  SavingProductReceivedEvent,
  SavingProductRefundedEvent,
} from "@workquest/database-models/lib/models";

export class SavingProductController implements IController {
  constructor (
    public readonly web3: Web3,
    protected readonly Logger: ILogger,
    public readonly network: BlockchainNetworks,
    public readonly contractProvider: IContractProvider,
  ) {
  }

  protected async onEvent(eventsData: EventData) {
    this.Logger.info('Event handler: name "%s", block number "%s", address "%s"',
      eventsData.event,
      eventsData.blockNumber,
      eventsData.address,
    );

    if (eventsData.event === TrackedEvents.Borrowed) {
      await this.borrowedEventHandler(eventsData);
    } else if (eventsData.event === TrackedEvents.Claimed) {
      await this.claimedEventHandler(eventsData);
    } else if (eventsData.event === TrackedEvents.Received) {
      await this.receivedEventHandler(eventsData);
    } else if (eventsData.event === TrackedEvents.Refunded) {
      await this.refundedEventHandler(eventsData);
    }
  }

  public async getLastCollectedBlock(): Promise<number> {
    const [{ lastParsedBlock }, ] = await SavingProductParseBlock.findOrCreate({
      where: { network: this.network },
      defaults: {
        network: this.network,
        lastParsedBlock: this.contractProvider.eventViewingHeight,
      },
    });

    this.Logger.debug('Last collected block: "%s"', lastParsedBlock);

    return lastParsedBlock;
  }

  protected async updateBlockViewHeight(blockHeight: number) {
    this.Logger.debug('Update blocks: new block height "%s"', blockHeight);

    await SavingProductParseBlock.update({ lastParsedBlock: blockHeight }, {
      where: {
        network: this.network,
        lastParsedBlock: { [Op.lt]: blockHeight },
      }
    });
  }

  protected async borrowedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.web3.eth.getBlock(eventsData.blockNumber);

    const transactionHash = eventsData.transactionHash.toLowerCase();
    const user = eventsData.returnValues.user.toLowerCase();

    this.Logger.debug('Borrowed event handler: timestamp "%s", event data %o',
      timestamp,
      eventsData,
    );

    const [, isCreated] = await SavingProductBorrowedEvent.findOrCreate({
      where: { transactionHash, network: this.network },
      defaults: {
        user,
        timestamp,
        transactionHash,
        blockNumber: eventsData.blockNumber,
        amount: eventsData.returnValues.amount,
        event: eventsData.event,
        network: this.network,
      },
    });

    if (!isCreated) {
      this.Logger.warn('Borrowed event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    return this.updateBlockViewHeight(eventsData.blockNumber);
  }

  protected async claimedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.web3.eth.getBlock(eventsData.blockNumber);

    const transactionHash = eventsData.transactionHash.toLowerCase();
    const user = eventsData.returnValues.user.toLowerCase();

    this.Logger.debug('Claimed event handler: timestamp "%s", event data %o',
      timestamp,
      eventsData,
    );

    const [, isCreated] = await SavingProductClaimedEvent.findOrCreate({
      where: { transactionHash, network: this.network },
      defaults: {
        user,
        timestamp,
        transactionHash,
        blockNumber: eventsData.blockNumber,
        amount: eventsData.returnValues.amount,
        event: eventsData.event,
        network: this.network,
      },
    });

    if (!isCreated) {
      this.Logger.warn('Claimed event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    return this.updateBlockViewHeight(eventsData.blockNumber);
  }

  protected async receivedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.web3.eth.getBlock(eventsData.blockNumber);

    const transactionHash = eventsData.transactionHash.toLowerCase();
    const user = eventsData.returnValues.user.toLowerCase();

    this.Logger.debug('Received event handler: timestamp "%s", event data %o',
      timestamp,
      eventsData,
    );

    const [, isCreated] = await SavingProductReceivedEvent.findOrCreate({
      where: { transactionHash, network: this.network },
      defaults: {
        user,
        timestamp,
        transactionHash,
        blockNumber: eventsData.blockNumber,
        amount: eventsData.returnValues.amount,
        event: eventsData.event,
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

    return this.updateBlockViewHeight(eventsData.blockNumber);
  }

  protected async refundedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.web3.eth.getBlock(eventsData.blockNumber);

    const transactionHash = eventsData.transactionHash.toLowerCase();
    const user = eventsData.returnValues.user.toLowerCase();

    this.Logger.debug('Refunded event handler: timestamp "%s", event data %o',
      timestamp,
      eventsData,
    );

    const [, isCreated] = await SavingProductRefundedEvent.findOrCreate({
      where: { transactionHash, network: this.network },
      defaults: {
        user,
        timestamp,
        transactionHash,
        blockNumber: eventsData.blockNumber,
        amount: eventsData.returnValues.amount,
        event: eventsData.event,
        network: this.network,
      },
    });

    if (!isCreated) {
      this.Logger.warn('Refunded event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    return this.updateBlockViewHeight(eventsData.blockNumber);
  }

  public async collectAllUncollectedEvents(fromBlockNumber: number) {
    const { events, error, lastBlockNumber } = await this.contractProvider.getEvents(fromBlockNumber);

    for (const event of events) {
      try {
        await this.onEvent(event);
      } catch (e) {
        this.Logger.error(e, 'Event processing ended with error');

        throw e;
      }
    }

    await this.updateBlockViewHeight(lastBlockNumber);

    if (error) {
      throw error;
    }
  }

  public async syncBlocks() {
    const lastParsedBlock = await this.getLastCollectedBlock();

    await this.collectAllUncollectedEvents(lastParsedBlock);
  }

  public async start() {
    await this.collectAllUncollectedEvents(
      await this.getLastCollectedBlock()
    );
  }
}

export class SavingProductListenerController extends SavingProductController {
  constructor(
    public readonly web3: Web3,
    protected readonly Logger: ILogger,
    public readonly network: BlockchainNetworks,
    public readonly contractProvider: IContractListenerProvider,
  ) {
    super(web3, Logger, network, contractProvider);
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
