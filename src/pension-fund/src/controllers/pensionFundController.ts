import { Clients, IContractProvider } from "../providers/types";
import { PensionFundEvent } from './types';
import { EventData } from 'web3-eth-contract';
import { Logger } from "../../logger/pino";
import { Op } from "sequelize";
import {
  BlockchainNetworks,
  PensionFundBlockInfo,
  PensionFundReceivedEvent,
  PensionFundWithdrewEvent,
  PensionFundWalletUpdatedEvent,
} from '@workquest/database-models/lib/models';

export class PensionFundController {
  constructor(
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

    if (eventsData.event === PensionFundEvent.Received) {
      await this.receivedEventHandler(eventsData);
    } else if (eventsData.event === PensionFundEvent.Withdrew) {
      await this.withdrewEventHandler(eventsData);
    } else if (eventsData.event === PensionFundEvent.WalletUpdated) {
      await this.walletUpdatedEventHandler(eventsData);
    }
  }

  protected updateBlockViewHeight(blockHeight: number) {
    Logger.debug('Update blocks: new block height "%s"', blockHeight);

    return PensionFundBlockInfo.update({ lastParsedBlock: blockHeight }, {
      where: {
        network: this.network,
        lastParsedBlock: { [Op.lt]: blockHeight },
      }
    });
  }

  protected async receivedEventHandler(eventsData: EventData) {
    const block = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const transactionHash = eventsData.transactionHash.toLowerCase();
    const user = eventsData.returnValues.user.toLowerCase();

    Logger.debug(
      'Received event handler: timestamp "%s", event data o%',
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
        event: PensionFundEvent.Received,
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

  protected async withdrewEventHandler(eventsData: EventData) {
    const block = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const transactionHash = eventsData.transactionHash.toLowerCase();
    const user = eventsData.returnValues.user.toLowerCase();

    Logger.debug(
      'Withdrew event handler: timestamp "%s", event data o%',
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
        event: PensionFundEvent.Withdrew,
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

    return this.updateBlockViewHeight(eventsData.blockNumber);
  }

  protected async walletUpdatedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const transactionHash = eventsData.transactionHash.toLowerCase();
    const user = eventsData.returnValues.user.toLowerCase();

    Logger.debug(
      'Wallet updated event handler: timestamp "%s", event data o%',
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
        event: PensionFundEvent.WalletUpdated,
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

    return this.updateBlockViewHeight(eventsData.blockNumber);
  }

  public async collectAllUncollectedEvents(fromBlockNumber: number) {
    Logger.info('Start collecting all uncollected events from block number: %s.', fromBlockNumber);

    const { collectedEvents, isGotAllEvents, lastBlockNumber } = await this.contractProvider.getAllEvents(fromBlockNumber);

    for (const event of collectedEvents) {
      try {
        await this.onEvent(event);
      } catch (e) {
        Logger.error(e, 'Event processing ended with error');

        throw e;
      }
    }

    await this.updateBlockViewHeight(lastBlockNumber);

    if (!isGotAllEvents) {
      throw new Error('Failed to process all events. Last processed block: ' + lastBlockNumber);
    }
  }
}
