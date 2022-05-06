import { Op } from "sequelize";
import { Logger } from "../../logger/pino";
import { EventData } from "web3-eth-contract";
import { IContractProvider } from "../../../types";
import { BridgeUSDTClients } from "../providers/types";
import { BridgeUSDTEvents, IController } from "./types";
import {
  BlockchainNetworks,
  BridgeUSDTSwapTokenEvent,
  BridgeUSDTParserBlockInfo,
} from "@workquest/database-models/lib/models";
import { BridgeEvents } from "../../../bridge/src/controllers/types";

export class BridgeUSDTController implements IController {
  constructor(
    public readonly clients: BridgeUSDTClients,
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

    if (eventsData.event === BridgeUSDTEvents.SwapInitialized) {
      return this.swapInitializedEventHandler(eventsData);
    }
  }

  protected updateBlockViewHeight(blockHeight: number) {
    Logger.debug('Update blocks: new block height "%s"', blockHeight);

    return BridgeUSDTParserBlockInfo.update({ lastParsedBlock: blockHeight }, {
      where: {
        network: this.network,
        lastParsedBlock: { [Op.lt]: blockHeight },
      }
    });
  }

  public async swapInitializedEventHandler(eventsData: EventData) {
    const transactionHash = eventsData.transactionHash.toLowerCase();
    const initiator = eventsData.returnValues.sender.toLowerCase();
    const recipient = eventsData.returnValues.recipient.toLowerCase();

    console.log(eventsData, this.network)
    Logger.debug(
      'Swap initialized event handler: timestamp "%s", event data %o',
      eventsData.returnValues.timestamp, eventsData
    );

    const [_, isCreated] = await BridgeUSDTSwapTokenEvent.findOrCreate({
      where: { transactionHash, network: this.network },
      defaults: {
        transactionHash,
        blockNumber: eventsData.blockNumber,
        network: this.network,
        event: BridgeEvents.SwapInitialized,
        nonce: eventsData.returnValues.nonce,
        timestamp: eventsData.returnValues.timestamp,
        initiator,
        recipient,
        amount: eventsData.returnValues.amount,
        chainTo: eventsData.returnValues.chainTo,
        chainFrom: eventsData.returnValues.chainFrom,
        symbol: eventsData.returnValues.symbol,
      }
    })

    if (!isCreated) {
      Logger.warn('Swap initialized event handler: event "%s" (tx hash "%s") handling is skipped because it has already been created',
        eventsData.event,
        transactionHash,
      );
      return;
    }

    //TODO нужно добавить job по переводу wqt на кошелёк recipient
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
