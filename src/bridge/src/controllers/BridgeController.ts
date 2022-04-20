import Web3 from "web3";
import {Op} from "sequelize";
import { Logger } from "../../logger/pino";
import {EventData} from "web3-eth-contract";
import {BridgeEvents, IController} from "./types";
import configBridge from "../../config/config.bridge";
import { BridgeClients } from "../providers/types";
import { IContractProvider } from "../../../types";
import {
  BlockchainNetworks,
  BridgeSwapTokenEvent,
  BridgeParserBlockInfo,
} from "@workquest/database-models/lib/models";

export class BridgeController implements IController {
  constructor(
    public readonly clients: BridgeClients,
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

    if (eventsData.event === BridgeEvents.SwapRedeemed) {
      return this.swapRedeemedEventHandler(eventsData);
    } else if (eventsData.event === BridgeEvents.SwapInitialized) {
      return this.swapInitializedEventHandler(eventsData);
    }
  }

  protected updateBlockViewHeight(blockHeight: number) {
    Logger.debug('Update blocks: new block height "%s"', blockHeight);

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

    Logger.debug(
      'Swap redeemed event handler: timestamp "%s", event data %o',
      eventsData.returnValues.timestamp,
      eventsData,
    );

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
      Logger.warn('Swap redeemed event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    await this.clients.notificationsBroker.sendNotification({
      recipients: [recipient],
      action: BridgeEvents.SwapRedeemed,
      data: eventsData
    });

    return this.updateBlockViewHeight(eventsData.blockNumber);
  }

  public async swapInitializedEventHandler(eventsData: EventData) {
    const transactionHash = eventsData.transactionHash.toLowerCase();
    const initiator = eventsData.returnValues.sender.toLowerCase();
    const recipient = eventsData.returnValues.recipient.toLowerCase();

    Logger.debug(
      'Swap initialized event handler: timestamp "%s", event data %o',
      eventsData.returnValues.timestamp, eventsData
    );

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
      Logger.warn('Swap initialized event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );

      return;
    }

    /** Не трогать последовательность */
    const sign = await this.clients.web3.eth.accounts.sign(this.clients.web3.utils.soliditySha3(
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

    await this.clients.notificationsBroker.sendNotification({
      recipients: [recipient],
      action: BridgeEvents.SwapInitialized,
      data: eventsData
    });

    return this.updateBlockViewHeight(eventsData.blockNumber);
  }

  public async collectAllUncollectedEvents(fromBlockNumber: number) {
    Logger.info('Start collecting all uncollected events from block number: %s.', fromBlockNumber);

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
