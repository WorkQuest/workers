import Web3 from "web3";
import {Op} from "sequelize";
import {Logger} from "../../logger/pino";
import {PensionFundEvents} from './types';
import {EventData} from 'web3-eth-contract';
import {INotificationClient} from "../../../middleware";
import {
  IController,
  IContractProvider,
  IContractListenerProvider,
} from "../../../types";
import {
  BlockchainNetworks,
  PensionFundBlockInfo,
  PensionFundReceivedEvent,
  PensionFundWithdrewEvent,
  PensionFundWalletUpdatedEvent,
} from '@workquest/database-models/lib/models';

export class PensionFundController implements IController {
  constructor(
    public readonly web3: Web3,
    public readonly network: BlockchainNetworks,
    public readonly contractProvider: IContractProvider,
    public readonly notificationClient: INotificationClient,
  ) {
  }

  protected async onEvent(eventsData: EventData) {
    Logger.info('Event handler: name "%s", block number "%s", address "%s"',
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

    Logger.debug('Last collected block: last block "%s"', lastParsedBlock);

    return lastParsedBlock;
  }

  protected updateBlockViewHeight(blockHeight: number) {
    Logger.debug('Update blocks: new block height "%s"', blockHeight);

    return PensionFundBlockInfo.update({ lastParsedBlock: blockHeight }, {
      where: {
        network: this.network,
        lastParsedBlock: { [Op.lt]: blockHeight },
      },
    });
  }

  protected async receivedEventHandler(eventsData: EventData) {
    const block = await this.web3.eth.getBlock(eventsData.blockNumber);

    const transactionHash = eventsData.transactionHash.toLowerCase();
    const user = eventsData.returnValues.user.toLowerCase();

    Logger.debug(
      'Received event handler: timestamp "%s", event data %o',
      block.timestamp, eventsData
    );

    const [, isCreated] = await PensionFundReceivedEvent.findOrCreate({
      where: { transactionHash, network: this.network },
      defaults: {
        user,
        transactionHash,
        timestamp: block.timestamp,
        blockNumber: eventsData.blockNumber,
        amount: eventsData.returnValues.amount,
        event: PensionFundEvents.Received,
        network: this.network,
      },
    });

    if (!isCreated) {
      Logger.warn('Received event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    await this.notificationClient.notify({
      recipients: [user],
      action: eventsData.event,
      data: eventsData
    });

    return this.updateBlockViewHeight(eventsData.blockNumber);
  }

  protected async withdrewEventHandler(eventsData: EventData) {
    const block = await this.web3.eth.getBlock(eventsData.blockNumber);

    const transactionHash = eventsData.transactionHash.toLowerCase();
    const user = eventsData.returnValues.user.toLowerCase();

    Logger.debug(
      'Withdrew event handler: timestamp "%s", event data %o',
      block.timestamp,
      eventsData,
    );

    const [, isCreated] = await PensionFundWithdrewEvent.findOrCreate({
      where: { transactionHash, network: this.network },
      defaults: {
        user,
        transactionHash,
        timestamp: block.timestamp,
        blockNumber: eventsData.blockNumber,
        amount: eventsData.returnValues.amount,
        event: PensionFundEvents.Withdrew,
        network: this.network,
      },
    });

    if (!isCreated) {
      Logger.warn('Withdrew event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    await this.notificationClient.notify({
      recipients: [user],
      action: eventsData.event,
      data: eventsData
    });

    return this.updateBlockViewHeight(eventsData.blockNumber);
  }

  protected async walletUpdatedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.web3.eth.getBlock(eventsData.blockNumber);

    const transactionHash = eventsData.transactionHash.toLowerCase();
    const user = eventsData.returnValues.user.toLowerCase();

    Logger.debug(
      'Wallet updated event handler: timestamp "%s", event data %o',
      timestamp,
      eventsData,
    );

    const [, isCreated] = await PensionFundWalletUpdatedEvent.findOrCreate({
      where: { transactionHash, network: this.network },
      defaults: {
        user,
        timestamp,
        transactionHash,
        blockNumber: eventsData.blockNumber,
        newFee: eventsData.returnValues.newFee,
        unlockDate: eventsData.returnValues.unlockDate,
        event: PensionFundEvents.WalletUpdated,
        network: this.network,
      },
    });

    if (!isCreated) {
      Logger.warn('Wallet updated event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    await this.notificationClient.notify({
      recipients: [user],
      action: eventsData.event,
      data: eventsData
    });

    return this.updateBlockViewHeight(eventsData.blockNumber);
  }

  protected async collectAllUncollectedEvents(fromBlockNumber: number) {
    Logger.info('Start collecting all uncollected events from block number: %s.', fromBlockNumber);

    const { events, error, lastBlockNumber } = await this.contractProvider.getEvents(fromBlockNumber);

    for (const event of events) {
      try {
        await this.onEvent(event);
      } catch (e) {
        Logger.error(e, 'Event processing ended with error');

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

export class PensionFundListenerController extends PensionFundController {
  constructor(
    public readonly web3: Web3,
    public readonly network: BlockchainNetworks,
    public readonly notificationClient: INotificationClient,
    public readonly contractProvider: IContractListenerProvider,
  ) {
    super(web3, network, contractProvider, notificationClient);
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
