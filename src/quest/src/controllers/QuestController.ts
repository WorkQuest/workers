import { Op } from "sequelize";
import { IController, QuestEvent } from "./types";
import { EventData } from "web3-eth-contract";
import { Logger } from "../../logger/pino";
import { QuestClients, IContractProvider } from "../providers/types";
import { QuestModelController } from "./models/QuestModelController";
import { UserModelController } from "./models/UserModelController";
import { QuestResponsesModelController } from "./models/QuestResponsesModelController";
import { QuestChatModelController } from "./models/QuestChatModelController";
import { updateQuestsStatisticJob } from "../../jobs/updateQuestsStatistic";
import { addUpdateReviewStatisticsJob } from "../../jobs/updateReviewStatistics";
import {
  UserRole,
  QuestStatus,
  QuestBlockInfo,
  QuestJobDoneEvent,
  BlockchainNetworks,
  QuestAssignedEvent,
  QuestJobDoneStatus,
  QuestJobStartedEvent,
  QuestJobFinishedEvent,
  QuestJobCancelledEvent,
  QuestAssignedEventStatus,
  QuestJobStartedEventStatus,
  QuestJobFinishedEventStatus,
  QuestJobCancelledEventStatus,
} from "@workquest/database-models/lib/models";

export class QuestController implements IController {
  constructor(
    public readonly clients: QuestClients,
    public readonly contractProvider: IContractProvider,
    public readonly network: BlockchainNetworks,
  ) {
    this.contractProvider.subscribeOnEvents(async (eventData) => {
      await this.onEvent(eventData);
    });
  }

  private async onEvent(eventsData: EventData) {
    Logger.info('Event handler: name %s, block number %s, address %s',
      eventsData.event,
      eventsData.blockNumber,
      eventsData.address,
    );

    if (eventsData.event === QuestEvent.Assigned) {
      await this.assignedEventHandler(eventsData);
    } else if (eventsData.event === QuestEvent.JobStarted) {
      await this.jobStartedEventHandler(eventsData);
    } else if (eventsData.event === QuestEvent.JobDone) {
      await this.jobDoneEventHandler(eventsData);
    } else if (eventsData.event === QuestEvent.JobFinished) {
      await this.jobFinishedEventHandler(eventsData);
    } else if (eventsData.event === QuestEvent.JobCancelled) {
      await this.jobCancelledEventHandler(eventsData);
    }
  }

  protected updateBlockViewHeight(blockHeight: number): Promise<any> {
    Logger.debug('Update blocks: new block height "%s"', blockHeight);

    return QuestBlockInfo.update({ lastParsedBlock: blockHeight }, {
      where: {
        network: this.network,
        lastParsedBlock: { [Op.lt]: blockHeight },
      }
    });
  }

  protected async jobCancelledEventHandler(eventsData: EventData) {
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const contractAddress = eventsData.address.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    const questModelController = await QuestModelController.byContractAddress(contractAddress);
    const questResponsesModelController = new QuestResponsesModelController(questModelController);
    const questChatModelController = new QuestChatModelController(questModelController);

    const [questJobCancelledEvent, isCreated] = await QuestJobCancelledEvent.findOrCreate({
      where: {
        transactionHash,
        network: this.network,
      }, defaults: {
        timestamp,
        contractAddress,
        transactionHash,
        network: this.network,
        blockNumber: eventsData.blockNumber,
        status: QuestJobCancelledEventStatus.Successfully,
      },
    });

    if (!isCreated) {
      Logger.warn('Job cancelled event handler: event "%s" handling is skipped because it has already been created',
        eventsData.event,
      );

      return;
    }

    await this.updateBlockViewHeight(eventsData.blockNumber);

    if (!questModelController) {
      Logger.warn('Job cancelled event handler: event "%s" handling is skipped because quest entity not found',
        eventsData.event,
      );

      return questJobCancelledEvent.update({ status: QuestJobCancelledEventStatus.QuestEntityNotFound });
    }
    if (!questModelController.statusDoesMatch(
      QuestStatus.Recruitment,
    )) {
      Logger.warn('Job cancelled event handler: event "%s" handling is skipped because quest status does not match',
        eventsData.event,
      );

      return questJobCancelledEvent.update({ status: QuestJobCancelledEventStatus.QuestStatusDoesNotMatch });
    }

    await Promise.all([
      questModelController.closeQuest(),
      questChatModelController.closeAllChats(),
      questResponsesModelController.closeAllResponses(),
    ]);
  }

  protected async assignedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const contractAddress = eventsData.address.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();
    const workerAddress = eventsData.returnValues.worker.toLowerCase();

    Logger.debug('Assigned event handler: timestamp "%s", event data o%', timestamp, eventsData);

    const workerModelController = await UserModelController.byWalletAddress(workerAddress);
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
      Logger.warn('Assigned event handler: event "%s" handling is skipped because it has already been created',
        eventsData.event,
      );

      return;
    }

    await this.updateBlockViewHeight(eventsData.blockNumber);

    if (!workerModelController || !questModelController) {
      Logger.warn('Assigned event handler (worker address: "%s") event "%s" handling is skipped because worker or quest entity not found',
        workerAddress,
        eventsData.event,
      );

      return questAssignedEvent.update({ status: QuestAssignedEventStatus.WorkerOrQuestEntityNotFound });
    }
    if (!questModelController.statusDoesMatch(
      QuestStatus.Recruitment,
      QuestStatus.WaitingForConfirmFromWorkerOnAssign,
    )) {
      Logger.warn('Assigned event handler (worker address: "%s") event "%s" handling is skipped because quest status does not match',
        workerAddress,
        eventsData.event,
      );

      return questAssignedEvent.update({ status: QuestAssignedEventStatus.QuestStatusDoesNotMatch });
    }

    // TODO нотификации
    await questModelController.assignWorkerOnQuest(workerModelController.user);
  }

  protected async jobStartedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const contractAddress = eventsData.address.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    Logger.debug('Job started event handler: timestamp "%s", event data o%', timestamp, eventsData);

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
      Logger.warn('Job started event handler: event "%s" handling is skipped because it has already been created',
        eventsData.event
      );

      return;
    }

    await this.updateBlockViewHeight(eventsData.blockNumber);

    if (!questModelController) {
      Logger.warn('Job started event handler: event "%s" handling is skipped because quest entity not found',
        eventsData.event,
      );

      return questJobStartedEvent.update({ status: QuestJobStartedEventStatus.QuestEntityNotFound });
    }
    if (!questModelController.statusDoesMatch(
      QuestStatus.WaitingForConfirmFromWorkerOnAssign,
    )) {
      Logger.warn('Job started event handler: event "%s" handling is skipped because quest status does not match',
        eventsData.event,
      );

      return questJobStartedEvent.update({ status: QuestJobStartedEventStatus.QuestStatusDoesNotMatch });
    }

    // TODO нотификации
    await Promise.all([
      questModelController.startQuest(),
      questResponsesModelController.closeAllWorkingResponses(),
      questChatModelController.closeAllWorkChatsExceptAssignedWorker(),
    ]);
  }

  protected async jobDoneEventHandler(eventsData: EventData) {
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const contractAddress = eventsData.address.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    Logger.debug('Job done event handler: timestamp "%s", event data o%', timestamp, eventsData);

    const questModelController = await QuestModelController.byContractAddress(contractAddress);

    const [questJobDoneEvent, isCreated] = await QuestJobDoneEvent.findOrCreate({
      where: {
        transactionHash,
        network: this.network,
      }, defaults: {
        timestamp,
        contractAddress,
        transactionHash,
        network: this.network,
        blockNumber: eventsData.blockNumber,
        status: QuestJobDoneStatus.Successfully,
      },
    });

    if (!isCreated) {
      Logger.warn('Job done event handler: event "%s" handling is skipped because it has already been created',
        eventsData.event
      );

      return;
    }

    await this.updateBlockViewHeight(eventsData.blockNumber);

    if (!questModelController) {
      Logger.warn('Job done event handler: event "%s" handling is skipped because quest entity not found',
        eventsData.event,
      );

      return questJobDoneEvent.update({ status: QuestJobDoneStatus.QuestEntityNotFound });
    }
    if (!questModelController.statusDoesMatch(
      QuestStatus.ExecutionOfWork,
    )) {
      Logger.warn('Job done event handler: event "%s" handling is skipped because quest status does not match',
        eventsData.event,
      );

      return questJobDoneEvent.update({ status: QuestJobDoneStatus.QuestStatusDoesNotMatch });
    }

    // TODO нотификации
    await questModelController.finishWork();
  }

  protected async jobFinishedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const contractAddress = eventsData.address.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    Logger.debug('Job finished event handler: timestamp "%s", event data o%', timestamp, eventsData);

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
        status: QuestJobFinishedEventStatus.Successfully,
      },
    });

    if (!isCreated) {
      Logger.warn('Job finished event handler: event "%s" handling is skipped because it has already been created',
        eventsData.event
      );

      return;
    }

    await this.updateBlockViewHeight(eventsData.blockNumber);

    if (!questModelController) {
      Logger.warn('Job finished event handler: event "%s" handling is skipped because quest entity not found',
        eventsData.event,
      );

      return questJobFinishedEvent.update({ status: QuestJobFinishedEventStatus.QuestEntityNotFound });
    }
    if (!questModelController.statusDoesMatch(
      QuestStatus.WaitingForEmployerConfirmationWork,
    )) {
      Logger.warn('Job finished event handler: event "%s" handling is skipped because quest status does not match',
        eventsData.event,
      );

      return questJobFinishedEvent.update({ status: QuestJobFinishedEventStatus.QuestStatusDoesNotMatch });
    }

    await Promise.all([
      questModelController.completeQuest(),
      this.clients.questCacheProvider.remove(contractAddress),
    ]);

    await Promise.all([
      addUpdateReviewStatisticsJob({ userId: questModelController.quest.userId }),
      addUpdateReviewStatisticsJob({ userId: questModelController.quest.assignedWorkerId }),
      updateQuestsStatisticJob({ userId: questModelController.quest.id, role: UserRole.Employer }),
      updateQuestsStatisticJob({ userId: questModelController.quest.assignedWorkerId, role: UserRole.Worker }),
    ]);
  }

  public async collectAllUncollectedEvents(fromBlockNumber: number) {
    Logger.info('Start collecting all uncollected events from block number: %s.', fromBlockNumber);

    const { collectedEvents, error, lastBlockNumber } = await this.contractProvider.getAllEvents(fromBlockNumber);

    for (const event of collectedEvents) {
      try {
        await this.onEvent(event);
      } catch (err) {
        Logger.error(err, 'Event processing ended with error');

        throw err;
      }
    }

    await this.updateBlockViewHeight(lastBlockNumber);

    if (error) {
      throw error;
    }
  }
}
