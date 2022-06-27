import { Op } from "sequelize";
import { Logger } from "../../logger/pino";
import { EventData } from "web3-eth-contract";
import { IController, TrackedEvents, Clients, IContractProvider } from "./types";
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
    public readonly clients: Clients,
    public readonly network: BlockchainNetworks,
    public readonly contractProvider: IContractProvider,
  ) {
    this.contractProvider.subscribeOnEvents(async (eventData) => {
      await this.onEvent(eventData);
    });
  }

  private async onEvent(eventsData: EventData) {
    Logger.info('Event handler: name "%s", block number "%s", address "%s"',
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

  protected updateBlockViewHeight(blockHeight: number) {
    Logger.debug('Update blocks: new block height "%s"', blockHeight);

    return SavingProductParseBlock.update({ lastParsedBlock: blockHeight }, {
      where: {
        network: this.network,
        lastParsedBlock: { [Op.lt]: blockHeight },
      }
    });
  }

  protected async borrowedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const transactionHash = eventsData.transactionHash.toLowerCase();
    const user = eventsData.returnValues.user.toLowerCase();

    Logger.debug('Borrowed event handler: timestamp "%s", event data %o',
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
      Logger.warn('Borrowed event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    return this.updateBlockViewHeight(eventsData.blockNumber);
  }

  protected async claimedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const transactionHash = eventsData.transactionHash.toLowerCase();
    const user = eventsData.returnValues.user.toLowerCase();

    Logger.debug('Claimed event handler: timestamp "%s", event data %o',
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
      Logger.warn('Claimed event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    return this.updateBlockViewHeight(eventsData.blockNumber);
  }

  protected async receivedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const transactionHash = eventsData.transactionHash.toLowerCase();
    const user = eventsData.returnValues.user.toLowerCase();

    Logger.debug('Received event handler: timestamp "%s", event data %o',
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
      Logger.warn('Received event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    return this.updateBlockViewHeight(eventsData.blockNumber);
  }

  protected async refundedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const transactionHash = eventsData.transactionHash.toLowerCase();
    const user = eventsData.returnValues.user.toLowerCase();

    Logger.debug('Refunded event handler: timestamp "%s", event data %o',
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
      Logger.warn('Refunded event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    return this.updateBlockViewHeight(eventsData.blockNumber);
  }

  public async collectAllUncollectedEvents(fromBlockNumber: number) {
    const { collectedEvents, error, lastBlockNumber } = await this.contractProvider.getAllEvents(fromBlockNumber);

    for (const event of collectedEvents) {
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
}
