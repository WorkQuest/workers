import Web3 from "web3";
import {Op} from "sequelize";
import {EventData} from "web3-eth-contract";
import {BridgeEvents, IController} from "./types";
import configBridge from "../../config/config.bridge";
import {Clients, IContractProvider} from "../providers/types";
import {
  BlockchainNetworks,
  BridgeSwapTokenEvent,
  BridgeParserBlockInfo,
} from "@workquest/database-models/lib/models";

export class BridgeController implements IController {
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
    if (eventsData.event === BridgeEvents.swapRedeemed) {
      return this.swapInitializedEventHandler(eventsData);
    } else if (eventsData.event === BridgeEvents.swapInitialized) {
      return this.swapRedeemedEventHandler(eventsData);
    }
  }

  //TODO Проверь тут плиз условие Op.lt
  protected updateBlockViewHeight(blockHeight: number) {
    return BridgeParserBlockInfo.update({ lastParsedBlock: blockHeight }, {
      where: {
        network: this.network,
        lastParsedBlock: { [Op.lt]: blockHeight },
      }
    });
  }

  public async swapRedeemedEventHandler(eventsData: EventData) {
    const transactionHash = eventsData.transactionHash.toLowerCase();
    const initiatorAddress = eventsData.returnValues.sender.toLowerCase();
    const recipientAddress = eventsData.returnValues.recipient.toLowerCase();

    /** Не трогать последовательность */
    const messageHash = this.clients.web3.eth.accounts.sign(Web3.utils.soliditySha3(
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
        messageHash,
        transactionHash,
        network: this.network,
        initiator: initiatorAddress,
        recipient: recipientAddress,
        event: BridgeEvents.swapRedeemed,
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
      return;
    }

    return this.updateBlockViewHeight(eventsData.blockNumber);
  }

  public async swapInitializedEventHandler(eventsData: EventData) {
    const transactionHash = eventsData.transactionHash.toLowerCase();
    const initiatorAddress = eventsData.returnValues.sender.toLowerCase();
    const recipientAddress = eventsData.returnValues.recipient.toLowerCase();

    /** Не трогать последовательность */
    const messageHash = this.clients.web3.eth.accounts.sign(Web3.utils.soliditySha3(
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
        messageHash,
        transactionHash,
        network: this.network,
        initiator: initiatorAddress,
        recipient: recipientAddress,
        event: BridgeEvents.swapInitialized,
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
      return;
    }

    return this.updateBlockViewHeight(eventsData.blockNumber);
  }

  public async collectAllUncollectedEvents(fromBlockNumber: number) {
    const {collectedEvents, isGotAllEvents, lastBlockNumber} = await this.contractProvider.getAllEvents(fromBlockNumber);

    for (const event of collectedEvents) {
      try {
        await this.onEvent(event);
      } catch (e) {
        console.error('Failed to process all events. Last processed block: ' + event.blockNumber);
        throw e;
      }
    }

    await this.updateBlockViewHeight(lastBlockNumber);

    if (!isGotAllEvents) {
      throw new Error('Failed to process all events. Last processed block: ' + collectedEvents[collectedEvents.length - 1]);
    }
  }
}
