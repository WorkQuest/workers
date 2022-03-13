import {Model, ModelCtor} from "sequelize";
import {IController, QuestEvent} from "./types";
import {EventData} from "web3-eth-contract";
import {Clients, IContractProvider} from "../providers/types";
import {QuestModelController} from "./models/QuestModelController";
import {UserModelController} from "./models/UserModelController";
import {QuestResponsesModelController} from "./models/QuestResponsesModelController";
import {QuestChatModelController} from "./models/QuestChatModelController";
import {
  QuestStatus,
  BlockchainNetworks,
  QuestAssignedEvent,
  QuestJobStartedEvent,
  QuestAssignedEventStatus,
} from "@workquest/database-models/lib/models";

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
      return this.jobStartedEventHandler(eventsData);
    } else if (eventsData.event === QuestEvent.JobFinished) {

    }
  }

  protected async assignedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const contractAddress = eventsData.address.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();
    const workerAddress = eventsData.returnValues.worker.toLowerCase();

    const workerModelController = await UserModelController.byWalletAddress(contractAddress);
    const questModelController = await QuestModelController.byContractAddress(contractAddress);

    const questAssignedEvent = {
      timestamp, workerAddress, contractAddress, transactionHash,
      network: this.network, status: QuestAssignedEventStatus.Successfully,
    }

    const assignedEventStatus = (workerModelController && questModelController)
      ? QuestAssignedEventStatus.Successfully
      : QuestAssignedEventStatus.WorkerOrQuestEntityNotFound

    if (questModelController.statusDoesMatch(
      QuestStatus.Recruitment,
      QuestStatus.WaitingForConfirmFromWorkerOnAssign,
    )) {

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

    // TODO нотификации
    await questModelController.assignWorkerOnQuest(workerModelController.user);
  }

  protected async jobStartedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const contractAddress = eventsData.address.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    const questModelController = await QuestModelController.byContractAddress(contractAddress);
    const questResponsesModelController = new QuestResponsesModelController(questModelController);
    const questChatModelController = new QuestChatModelController(questModelController);

    if (!questModelController) {
      return;
    }

    const [, isCreated] = await QuestJobStartedEvent.findOrCreate({
      where: {
        transactionHash,
        network: this.network,
      }, defaults: {
        timestamp,
        contractAddress,
        transactionHash,
        network: this.network,
      },
    });

    if (!isCreated) {
      return;
    }

    // TODO in throw
    questModelController.checkQuestStatus(
      QuestStatus.WaitingForConfirmFromWorkerOnAssign
    );

    // TODO нотификации
    await questModelController.startQuest();
    await questResponsesModelController.closeAllWorkingResponses();
    await questChatModelController.closeAllWorkChatsExceptAssignedWorker();
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

  // static findOrCreateQuestEvent<T extends Model>(modelInstance: ModelCtor<T>, event: any): Promise<[T, boolean]> {
  //   return modelInstance.findOrCreate<T>({ where: { }, defaults: event });
  // }
}
