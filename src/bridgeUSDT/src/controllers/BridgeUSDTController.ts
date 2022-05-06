import { Logger } from "../../logger/pino";
import { EventData } from "web3-eth-contract";
import { BridgeUSDTEvents, IController } from "./types";
import { BridgeUSDTClients } from "../providers/types";
import { IContractProvider } from "../../../types";
import {
  BlockchainNetworks,
  // BridgeUSDTSwapTokenEvent,
  // BridgeUSDTParserBlockInfo,
} from "@workquest/database-models/lib/models";

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

  // protected updateBlockViewHeight(blockHeight: number) {
  //   Logger.debug('Update blocks: new block height "%s"', blockHeight);
  //
  //   return BridgeUSDTParserBlockInfo.update({ lastParsedBlock: blockHeight }, {
  //     where: {
  //       network: this.network,
  //       lastParsedBlock: { [Op.lt]: blockHeight },
  //     }
  //   });
  // }

  public async swapInitializedEventHandler(eventsData: EventData) {
    const transactionHash = eventsData.transactionHash.toLowerCase();
    const initiator = eventsData.returnValues.sender.toLowerCase();
    const recipient = eventsData.returnValues.recipient.toLowerCase();

    console.log(eventsData)
    Logger.debug(
      'Swap initialized event handler: timestamp "%s", event data %o',
      eventsData.returnValues.timestamp, eventsData
    );

    // return this.updateBlockViewHeight(eventsData.blockNumber);
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

    // await this.updateBlockViewHeight(lastBlockNumber);

    if (error) {
      throw error;
    }
  }
}
