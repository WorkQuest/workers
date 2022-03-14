import {Op} from 'sequelize';
import {IController, QuestEvent} from "./types";
import {EventData} from "web3-eth-contract";
import {Clients, IContractProvider} from "../providers/types";
import {QuestModelController} from "./models/QuestModelController";
import {UserModelController} from "./models/UserModelController";
import {QuestResponsesModelController} from "./models/QuestResponsesModelController";
import {QuestChatModelController} from "./models/QuestChatModelController";
import {
  QuestStatus,
  QuestBlockInfo,
  BlockchainNetworks,
  QuestAssignedEvent,
  QuestJobStartedEvent,
  QuestJobFinishedEvent,
  QuestAssignedEventStatus,
  QuestJobStartedEventStatus,
} from "@workquest/database-models/lib/models";

// TODO add event block number
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

  private onEvent(eventsData: EventData): Promise<any> {
    if (eventsData.event === QuestEvent.Assigned) {
      return this.assignedEventHandler(eventsData);
    } else if (eventsData.event === QuestEvent.JobStarted) {
      return this.jobStartedEventHandler(eventsData);
    } else if (eventsData.event === QuestEvent.JobFinished) {
      return this.jobFinishedEventHandler(eventsData);
    } else if (eventsData.event === QuestEvent.JobDone) {
      return this.jobDoneEventHandler(eventsData);
    }
  }

  protected updateBlockViewHeight(blockHeight: number) {
    return QuestBlockInfo.update({ lastParsedBlock: blockHeight }, {
      where: {
        network: this.network,
        lastParsedBlock: { [Op.lt]: blockHeight },
      }
    });
  }

  protected async assignedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const contractAddress = eventsData.address.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();
    const workerAddress = eventsData.returnValues.worker.toLowerCase();

    const workerModelController = await UserModelController.byWalletAddress(contractAddress);
    const questModelController = await QuestModelController.byContractAddress(contractAddress);

    const [questAssignedEvent, isCreated] = await QuestAssignedEvent.findOrCreate({
      where: {
        transactionHash,
        network: this.network,
      }, defaults: {
        timestamp,
        workerAddress,
        contractAddress,
        transactionHash,
        network: this.network,
        blockNumber: eventsData.blockNumber,
        status: QuestAssignedEventStatus.Successfully,
      }
    });

    if (!isCreated) {
      return;
    }

    await this.updateBlockViewHeight(eventsData.blockNumber);

    if (!workerModelController && !questModelController) {
      return questAssignedEvent.update({
        status: QuestAssignedEventStatus.WorkerOrQuestEntityNotFound,
      });
    }
    if (!questModelController.statusDoesMatch(
        QuestStatus.Recruitment,
        QuestStatus.WaitingForConfirmFromWorkerOnAssign
    )) {
      return questAssignedEvent.update({
        status: QuestAssignedEventStatus.QuestStatusDoesNotMatch,
      });
    }

    if (questModelController.quest.status === QuestStatus.WaitingForConfirmFromWorkerOnAssign) {
      // TODO нотификации о переназначении.
    }

    // TODO нотификации о назначении
    await questModelController.assignWorkerOnQuest(workerModelController.user);
  }

  protected async jobStartedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const contractAddress = eventsData.address.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    const questModelController = await QuestModelController.byContractAddress(contractAddress);
    const questResponsesModelController = new QuestResponsesModelController(questModelController);
    const questChatModelController = new QuestChatModelController(questModelController);

    const [questJobStartedEvent, isCreated] = await QuestJobStartedEvent.findOrCreate({
      where: {
        transactionHash,
        network: this.network,
      }, defaults: {
        timestamp,
        contractAddress,
        transactionHash,
        network: this.network,
        blockNumber: eventsData.blockNumber,
        status: QuestJobStartedEventStatus.Successfully,
      },
    });

    if (!isCreated) {
      return;
    }

    await this.updateBlockViewHeight(eventsData.blockNumber);

    if (!questModelController) {
      return questJobStartedEvent.update({
        status: QuestJobStartedEventStatus.QuestEntityNotFound,
      });
    }
    if (!questModelController.statusDoesMatch(
      QuestStatus.WaitingForConfirmFromWorkerOnAssign,
    )) {
      return questJobStartedEvent.update({
        status: QuestJobStartedEventStatus.QuestStatusDoesNotMatch,
      });
    }

    // TODO нотификации
    await questModelController.startQuest();
    await questResponsesModelController.closeAllWorkingResponses();
    await questChatModelController.closeAllWorkChatsExceptAssignedWorker();
  }

  protected async jobFinishedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const contractAddress = eventsData.address.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    const questModelController = await QuestModelController.byContractAddress(contractAddress);

    const [questJobFinishedEvent, isCreated] = await QuestJobFinishedEvent.findOrCreate({
      where: {
        transactionHash,
        network: this.network,
      }, defaults: {
        timestamp,
        contractAddress,
        transactionHash,
        network: this.network,
        blockNumber: eventsData.blockNumber,
      }
    });

    if (!isCreated) {
      return;
    }

    await this.updateBlockViewHeight(eventsData.blockNumber);

    if (!questModelController) {

    }
    if (!questModelController.statusDoesMatch(
      QuestStatus.ExecutionOfWork,
    )) {

    }

    await questModelController.finishWorkOnQuest();
  }

  protected async jobDoneEventHandler(eventsData: EventData) {
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const contractAddress = eventsData.address.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    const questModelController = await QuestModelController.byContractAddress(contractAddress);
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
