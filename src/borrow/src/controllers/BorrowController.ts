import { Web3Provider } from "../providers/types";
import { BlockchainNetworks } from "@workquest/database-models/lib/models";
import { EventData } from "web3-eth-contract";

export class BorrowController {
  constructor(
    private readonly web3Provider: Web3Provider,
    private readonly network: BlockchainNetworks,
  ) {
    this.web3Provider.subscribeOnEvents(async (eventData) => {
      await this.onEvent(eventData);
    });
  }

  private async onEvent(eventsData: EventData) {

  }
}
