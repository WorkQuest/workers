import {IController, QuestEvent} from "./types";
import { EventData } from "web3-eth-contract";
import { Clients, IContractProvider } from "../providers/types";
import {BlockchainNetworks, Quest, QuestAssignedEvent, QuestStatus} from "@workquest/database-models/lib/models";
import {QuestAssignedEventStatus} from "@workquest/database-models/src/models/quest/contract-quest/QuestAssignedEvent";

export class QuestController implements IController {
  constructor(
    public readonly clients: Clients,
    public readonly contractProvider: IContractProvider,
    public readonly network: BlockchainNetworks,
  ) {
    this.contractProvider.subscribeOnEvents(async (eventData) => {
      await this.onEvent(eventData);
    });
  }

  private onEvent(eventsData: EventData): Promise<void> {
    if (eventsData.event === QuestEvent.Assigned) {
      return this.assignedEventHandler(eventsData);
    } else if (eventsData.event === QuestEvent.JobStarted) {

    } else if (eventsData.event === QuestEvent.JobFinished) {

    }
  }

  protected async assignedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const contractAddress = eventsData.address.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();
    const workerAddress = eventsData.returnValues.worker.toLowerCase();

    const quest = await Quest.findOne({ where: { contractAddress } });

    if (!quest) {
      return;
    }

    const [, isCreated] = await QuestAssignedEvent.findOrCreate({
      where: {
        transactionHash,
        network: this.network,
      }, defaults: {
        timestamp,
        workerAddress,
        contractAddress,
        transactionHash,
        network: this.network,
        status: QuestAssignedEventStatus.Successfully,
      }
    });

    if (!isCreated) {
      return;
    }

    quest.update({ status: QuestStatus.WaitingForConfirmFromWorkerOnAssign });
  }

  public async collectAllUncollectedEvents(fromBlockNumber: number) {
    const { collectedEvents, isGotAllEvents } = await this.contractProvider.getAllEvents(fromBlockNumber);

    for (const event of collectedEvents) {
      try {
        await this.onEvent(event);
      } catch (err) {
        console.error('Failed to process all events. Last processed block: ' + event.blockNumber);
        throw err;
      }
    }

    if (!isGotAllEvents) {
      throw new Error('Failed to process all events. Last processed block: ' + collectedEvents[collectedEvents.length - 1]);
    }
  }
}
