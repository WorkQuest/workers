import { Web3Provider } from "../providers/types";
import { EventData } from "web3-eth-contract";
import { TrackedEvents } from "./types";
import {
  Borrowing,
  BorrowingStatus,
  BlockchainNetworks,
  BorrowingParseBlock,
  BorrowingBorrowedEvent,
  BorrowingRefundedEvent,
} from "@workquest/database-models/lib/models";

export class BorrowingController {
  constructor(
    private readonly web3Provider: Web3Provider,
    private readonly network: BlockchainNetworks,
  ) {
    this.web3Provider.subscribeOnEvents(async (eventData) => {
      await this.onEvent(eventData);
    });
  }

  private async onEvent(eventsData: EventData) {
    if (eventsData.event === TrackedEvents.Borrowed) {
      return this.borrowingBorrowedEventHandler(eventsData);
    } else if (eventsData.event === TrackedEvents.Refunded) {
      return this.borrowingRefundedEventHandler(eventsData);
    }
  }

  protected updateLastParseBlock(lastParsedBlock: number): Promise<void> {
    return void BorrowingParseBlock.update(
      { lastParsedBlock },
      { where: { network: this.network } }
    );
  }

  protected async borrowingBorrowedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.web3Provider.web3.eth.getBlock(eventsData.blockNumber);

    const borrower = eventsData.returnValues.user.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    const borrowing = await Borrowing.findOne({
      where: { nonce: eventsData.returnValues.nonce }
    });

    const [_, isCreated] = await BorrowingBorrowedEvent.findOrCreate({
      where: {
        transactionHash,
        network: this.network,
      },
      defaults: {
        borrower,
        timestamp,
        transactionHash,
        network: this.network,
        borrowingId: borrowing ? borrowing.id : null,
        nonce: eventsData.returnValues.nonce,
        collateral: eventsData.returnValues.collateral,
        credit: eventsData.returnValues.credit,
        symbol: eventsData.returnValues.symbol
      }
    });

    if (!isCreated) {
      return this.updateLastParseBlock(eventsData.blockNumber);
    }

    return Promise.all([
      this.updateLastParseBlock(eventsData.blockNumber),
      borrowing.update({ status: BorrowingStatus.Active })
    ]);
  }

  protected async borrowingRefundedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.web3Provider.web3.eth.getBlock(eventsData.blockNumber);

    const borrower = eventsData.returnValues.user.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    const borrowing = await Borrowing.findOne({
      where: { nonce: eventsData.returnValues.nonce }
    });

    const [_, isCreated] = await BorrowingRefundedEvent.findOrCreate({
      where: {
        transactionHash,
        network: this.network,
      },
      defaults: {
        borrower,
        timestamp,
        transactionHash,
        network: this.network,
        borrowingId: borrowing ? borrowing.id : null,
        nonce: eventsData.returnValues.nonce,
        amount: eventsData.returnValues.amount
      }
    });

    if (!isCreated) {
      return this.updateLastParseBlock(eventsData.blockNumber);
    }

    const remainingAmount = parseFloat(borrowing.remainingCredit) - parseFloat(eventsData.returnValues.amount);
    const status = remainingAmount <= 0 ? BorrowingStatus.Closed : BorrowingStatus.Active;

    return Promise.all([
      this.updateLastParseBlock(eventsData.blockNumber),
      borrowing.update({ status, remainingAmount })
    ]);
  }

  public async collectAllUncollectedEvents(fromBlockNumber: number) {
    const { collectedEvents, isGotAllEvents, lastBlockNumber } = await this.web3Provider.getAllEvents(fromBlockNumber);

    for (const event of collectedEvents) {
      try {
        await this.onEvent(event);
      } catch (e) {
        console.error('Failed to process all events. Last processed block: ' + event.blockNumber);
        throw e;
      }
    }

    await BorrowingParseBlock.update(
      { lastParsedBlock: lastBlockNumber },
      { where: { network: this.network } }
    );

    if (!isGotAllEvents) {
      throw new Error('Failed to process all events. Last processed block: ' + collectedEvents[collectedEvents.length - 1]);
    }
  }
}
