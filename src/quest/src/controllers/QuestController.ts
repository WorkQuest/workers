import { Op } from "sequelize";
import { IController, QuestEvent, QuestNotificationActions } from "./types";
import { EventData } from "web3-eth-contract";
import { Logger } from "../../logger/pino";
import { IContractProvider, QuestClients } from "../providers/types";
import { QuestModelController } from "./models/QuestModelController";
import { UserModelController } from "./models/UserModelController";
import { QuestResponsesModelController } from "./models/QuestResponsesModelController";
import { QuestChatModelController } from "./models/QuestChatModelController";
import { QuestDisputeModelController } from "./models/QuestDisputeModelController";
import { updateQuestsStatisticJob } from "../../jobs/updateQuestsStatistic";
import { addUpdateReviewStatisticsJob } from "../../jobs/updateReviewStatistics";
import {
  UserRole,
  QuestStatus,
  DisputeStatus,
  QuestBlockInfo,
  DisputeDecision,
  QuestJobDoneEvent,
  QuestJobDoneStatus,
  BlockchainNetworks,
  QuestAssignedEvent,
  QuestJobEditedEvent,
  QuestJobStartedEvent,
  QuestJobEditedStatus,
  QuestJobFinishedEvent,
  QuestJobCancelledEvent,
  QuestAssignedEventStatus,
  QuestJobStartedEventStatus,
  QuestArbitrationReworkEvent,
  QuestJobFinishedEventStatus,
  QuestArbitrationReworkStatus,
  QuestArbitrationStartedEvent,
  QuestJobCancelledEventStatus,
  QuestArbitrationStartedStatus,
  QuestArbitrationRejectWorkEvent,
  QuestArbitrationAcceptWorkEvent,
  QuestArbitrationAcceptWorkStatus,
  QuestArbitrationRejectWorkStatus, QuestsResponseType,
} from "@workquest/database-models/lib/models";
import { incrementAdminDisputeStatisticJob } from "../../jobs/incrementAdminDisputeStatistic";

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
    } else if (eventsData.event === QuestEvent.JobEdited) {
      await this.jobEditedEventHandler(eventsData);
    } else if (eventsData.event === QuestEvent.ArbitrationStarted) {
      await this.arbitrationStartedEventHandler(eventsData);
    } else if (eventsData.event === QuestEvent.ArbitrationAcceptWork) {
      await this.arbitrationAcceptWorkEventHandler(eventsData);
    } else if (eventsData.event === QuestEvent.ArbitrationRejectWork) {
      await this.arbitrationRejectWorkEventHandler(eventsData);
    } else if (eventsData.event === QuestEvent.ArbitrationRework) {
      await this.arbitrationReworkEventHandler(eventsData);
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

  protected async jobEditedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.clients.web3.eth.getBlock(eventsData.blockNumber);

    const contractAddress = eventsData.address.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    const questModelController = await QuestModelController.byContractAddress(contractAddress);
    const questResponsesModelController = new QuestResponsesModelController(questModelController);

    const [questJobEditedEvent, isCreated] = await QuestJobEditedEvent.findOrCreate({
      where: {
        transactionHash,
        network: this.network,
      }, defaults: {
        timestamp,
        contractAddress,
        transactionHash,
        cost: eventsData.returnValues.cost,
        blockNumber: eventsData.blockNumber,
        status: QuestJobCancelledEventStatus.Successfully,
        network: this.network,
      },
    });

    if (!isCreated) {
      Logger.warn('Job edited event handler: event "%s" handling is skipped because it has already been created',
        eventsData.event,
      );

      return;
    }

    await this.updateBlockViewHeight(eventsData.blockNumber);

    if (!questModelController) {
      Logger.warn('Job edited event handler: event "%s" handling is skipped because quest entity not found',
        eventsData.event,
      );

      return questJobEditedEvent.update({ status: QuestJobEditedStatus.QuestEntityNotFound });
    }
    if (!questModelController.statusDoesMatch(
      QuestStatus.Recruitment,
    )) {
      Logger.warn('Job edited event handler: event "%s" handling is skipped because quest status does not match',
        eventsData.event,
      );

      return questJobEditedEvent.update({ status: QuestJobEditedStatus.QuestStatusDoesNotMatch });
    }

    await questModelController.editQuest({
      price: eventsData.returnValues.cost,
    });

    const responses = await questResponsesModelController.getActiveResponses();
    const responseWorkerIds = responses.map(response => {
      return {
        workerId: response.workerId,
        responseType: response.type
      }
    });

    const invitedWorkerIds = responseWorkerIds
      .filter(response => response.responseType === QuestsResponseType.Invite)
      .map(response => response.workerId);
    const respondedWorkerIds = responseWorkerIds
      .filter(response => response.responseType === QuestsResponseType.Response)
      .map(response => response.workerId);

    await this.clients.notificationsBroker.sendNotification({
      recipients: invitedWorkerIds,
      action: QuestNotificationActions.QuestEdited,
      data: { ...questModelController.quest, responseType: QuestsResponseType.Invite },
    });

    await this.clients.notificationsBroker.sendNotification({
      recipients: respondedWorkerIds,
      action: QuestNotificationActions.QuestEdited,
      data: { ...questModelController.quest, responseType: QuestsResponseType.Response },
    });

    await this.clients.notificationsBroker.sendNotification({
      recipients: [questModelController.quest.userId],
      action: QuestNotificationActions.QuestEdited,
      data: questModelController.quest,
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
      this.clients.questCacheProvider.remove(contractAddress),
    ]);

    await this.clients.notificationsBroker.sendNotification({
      recipients: [questModelController.quest.userId],
      action: QuestNotificationActions.QuestStatusUpdated,
      data: questModelController.quest
    });
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

    await questModelController.assignWorkerOnQuest(workerModelController.user);
    await this.clients.notificationsBroker.sendNotification({
      recipients: [questModelController.quest.userId, workerModelController.user.id],
      action: QuestNotificationActions.QuestStatusUpdated,
      data: questModelController.quest,
    });
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

    await Promise.all([
      questModelController.startQuest(),
      questResponsesModelController.closeAllWorkingResponses(),
      questChatModelController.closeAllWorkChatsExceptAssignedWorker(),
    ]);

    await this.clients.notificationsBroker.sendNotification({
      recipients: [questModelController.quest.assignedWorkerId, questModelController.quest.userId],
      action: QuestNotificationActions.QuestStatusUpdated,
      data: questModelController.quest
    });
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

    await questModelController.finishWork();
    await this.clients.notificationsBroker.sendNotification({
      recipients: [questModelController.quest.assignedWorkerId, questModelController.quest.userId],
      action: QuestNotificationActions.QuestStatusUpdated,
      data: questModelController.quest
    });
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
      updateQuestsStatisticJob({ userId: questModelController.quest.userId, role: UserRole.Employer }),
      updateQuestsStatisticJob({ userId: questModelController.quest.assignedWorkerId, role: UserRole.Worker }),
      this.clients.communicationBroker.sendMessage({
        blockNumber: eventsData.blockNumber
      }),
      this.clients.notificationsBroker.sendNotification({
        recipients: [questModelController.quest.assignedWorkerId, questModelController.quest.userId],
        action: QuestNotificationActions.QuestStatusUpdated,
        data: questModelController.quest
      }),
    ]);
  }

  protected async arbitrationStartedEventHandler(eventsData: EventData) {
    const timestamp = eventsData.returnValues.timestamp;
    const contractAddress = eventsData.address.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    Logger.debug('Arbitration started event handler: timestamp "%s", event data %o', timestamp, eventsData);

    const questModelController = await QuestModelController.byContractAddress(contractAddress);
    const questDisputeModelController = await QuestDisputeModelController.byContractAddress(contractAddress);

    const [questArbitrationStartedEvent, isCreated] = await QuestArbitrationStartedEvent.findOrCreate({
      where: {
        transactionHash,
        network: this.network,
      },
      defaults: {
        timestamp,
        contractAddress,
        transactionHash,
        network: this.network,
        blockNumber: eventsData.blockNumber,
        status: QuestArbitrationStartedStatus.Successfully,
      }
    });

    if (!isCreated) {
      Logger.warn('Arbitration started event handler: event "%s" is skipped because is has already been created',
        eventsData.event
      );

      return;
    }

    await this.updateBlockViewHeight(eventsData.blockNumber);

    if (!questDisputeModelController) {
      Logger.warn('Arbitration started event handler: event "%s" is skipped because dispute entity not found',
        eventsData.event
      );

      return questArbitrationStartedEvent.update({ status: QuestArbitrationStartedStatus.DisputeNotFound });
    }

    if (!questDisputeModelController.statusDoesMatch(DisputeStatus.Pending)) {
      Logger.warn('Arbitration started event handler: event "%s" is skipped because dispute status does not match',
        eventsData.event
      );

      return questArbitrationStartedEvent.update({ status: QuestArbitrationStartedStatus.DisputeStatusDoesNotMatch });
    }

    await questModelController.freezeQuestForDispute();
    await questDisputeModelController.confirmDispute();

    await this.clients.notificationsBroker.sendNotification({
      recipients: [questModelController.quest.userId, questModelController.quest.assignedWorkerId],
      action: QuestNotificationActions.OpenDispute,
      data: questDisputeModelController.dispute,
    });
  }

  protected async arbitrationAcceptWorkEventHandler(eventsData: EventData) {
    const timestamp = eventsData.returnValues.timestamp;
    const contractAddress = eventsData.address.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    Logger.debug('Arbitration accept work event handler: timestamp "%s", event data %o', timestamp, eventsData);

    const questModelController = await QuestModelController.byContractAddress(contractAddress);
    const questDisputeModelController = await QuestDisputeModelController.byContractAddress(contractAddress);
    const questChatModelController = new QuestChatModelController(questModelController);

    const [questArbitrationAcceptWorkEvent, isCreated] = await QuestArbitrationAcceptWorkEvent.findOrCreate({
      where: {
        transactionHash,
        network: this.network,
      },
      defaults: {
        timestamp,
        contractAddress,
        transactionHash,
        network: this.network,
        blockNumber: eventsData.blockNumber,
        status: QuestArbitrationAcceptWorkStatus.Successfully,
      }
    });

    if (!isCreated) {
      Logger.warn('Arbitration accept work event handler: event "%s" is skipped because is has already been created',
        eventsData.event
      );

      return;
    }

    await this.updateBlockViewHeight(eventsData.blockNumber);

    if (!questDisputeModelController) {
      Logger.warn('Arbitration accept work event handler: event "%s" is skipped because dispute entity not found',
        eventsData.event
      );

      return questArbitrationAcceptWorkEvent.update({ status: QuestArbitrationAcceptWorkStatus.DisputeNotFound });
    }

    if (!questDisputeModelController.statusDoesMatch(DisputeStatus.InProgress)) {
      Logger.warn('Arbitration accept work event handler: event "%s" is skipped because dispute status does not match',
        eventsData.event
      );

      return questArbitrationAcceptWorkEvent.update({ status: QuestArbitrationAcceptWorkStatus.DisputeStatusDoesNotMatch });
    }

    if (!questModelController) {
      Logger.warn('Arbitration accept work event handler: event "%s" is skipped because quest entity not found',
        eventsData.event
      )

      return questArbitrationAcceptWorkEvent.update({ status: QuestArbitrationAcceptWorkStatus.QuestNotFound });
    }

    await questModelController.completeQuest();
    await questDisputeModelController.closeDispute(DisputeDecision.AcceptWork, timestamp);
    await questChatModelController.closeAllChats();

    await this.clients.questCacheProvider.remove(contractAddress);

    await Promise.all([
      addUpdateReviewStatisticsJob({ userId: questModelController.quest.userId }),
      addUpdateReviewStatisticsJob({ userId: questModelController.quest.assignedWorkerId }),
      updateQuestsStatisticJob({ userId: questModelController.quest.userId, role: UserRole.Employer }),
      updateQuestsStatisticJob({ userId: questModelController.quest.assignedWorkerId, role: UserRole.Worker }),
      incrementAdminDisputeStatisticJob({
        adminId: questDisputeModelController.dispute.assignedAdminId,
        resolutionTimeInSeconds: (
          questDisputeModelController.dispute.resolvedAt.getTime() -
          questDisputeModelController.dispute.acceptedAt.getTime()
        ) / 1000,
      }),
      this.clients.notificationsBroker.sendNotification({
        recipients: [questModelController.quest.assignedWorkerId, questModelController.quest.userId],
        action: QuestNotificationActions.QuestStatusUpdated,
        data: questModelController.quest
      }),
      this.clients.notificationsBroker.sendNotification({
        recipients: [questModelController.quest.userId, questModelController.quest.assignedWorkerId],
        action: QuestNotificationActions.DisputeDecision,
        data: questDisputeModelController.dispute,
      }),
    ]);
  }

  protected async arbitrationRejectWorkEventHandler(eventsData: EventData) {
    const timestamp = eventsData.returnValues.timestamp;
    const contractAddress = eventsData.address.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    Logger.debug('Arbitration reject work event handler: timestamp "%s", event data %o', timestamp, eventsData);

    const questModelController = await QuestModelController.byContractAddress(contractAddress);
    const questDisputeModelController = await QuestDisputeModelController.byContractAddress(contractAddress);
    const questChatModelController = new QuestChatModelController(questModelController);

    const [questArbitrationRejectWorkEvent, isCreated] = await QuestArbitrationRejectWorkEvent.findOrCreate({
      where: {
        transactionHash,
        network: this.network,
      },
      defaults: {
        timestamp,
        contractAddress,
        transactionHash,
        network: this.network,
        blockNumber: eventsData.blockNumber,
        status: QuestArbitrationRejectWorkStatus.Successfully,
      }
    });

    if (!isCreated) {
      Logger.warn('Arbitration reject work event handler: event "%s" is skipped because is has already been created',
        eventsData.event
      );

      return;
    }

    await this.updateBlockViewHeight(eventsData.blockNumber);

    if (!questDisputeModelController) {
      Logger.warn('Arbitration reject work event handler: event "%s" is skipped because dispute entity not found',
        eventsData.event
      );

      return questArbitrationRejectWorkEvent.update({ status: QuestArbitrationRejectWorkStatus.DisputeNotFound });
    }

    if (!questDisputeModelController.statusDoesMatch(DisputeStatus.InProgress)) {
      Logger.warn('Arbitration reject work event handler: event "%s" is skipped because dispute status does not match',
        eventsData.event
      );

      return questArbitrationRejectWorkEvent.update({ status: QuestArbitrationRejectWorkStatus.DisputeStatusDoesNotMatch });
    }

    if (!questModelController) {
      Logger.warn('Arbitration reject work event handler: event "%s" is skipped because quest entity not found',
        eventsData.event
      )

      return questArbitrationRejectWorkEvent.update({ status: QuestArbitrationRejectWorkStatus.QuestNotFound });
    }

    await questModelController.closeQuest();
    await questDisputeModelController.closeDispute(DisputeDecision.RejectWork, timestamp);
    await questChatModelController.closeAllChats();

    await this.clients.questCacheProvider.remove(contractAddress);

    await Promise.all([
      incrementAdminDisputeStatisticJob({
        adminId: questDisputeModelController.dispute.assignedAdminId,
        resolutionTimeInSeconds: (
          questDisputeModelController.dispute.resolvedAt.getTime() -
          questDisputeModelController.dispute.acceptedAt.getTime()
        ) / 1000,
      }),
      this.clients.notificationsBroker.sendNotification({
        recipients: [questModelController.quest.assignedWorkerId, questModelController.quest.userId],
        action: QuestNotificationActions.QuestStatusUpdated,
        data: questModelController.quest
      }),
      this.clients.notificationsBroker.sendNotification({
        recipients: [questModelController.quest.userId, questModelController.quest.assignedWorkerId],
        action: QuestNotificationActions.DisputeDecision,
        data: questDisputeModelController.dispute,
      }),
    ]);
  }

  protected async arbitrationReworkEventHandler(eventsData: EventData) {
    const timestamp = eventsData.returnValues.timestamp;
    const contractAddress = eventsData.address.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    Logger.debug('Arbitration rework event handler: timestamp "%s", event data %o', timestamp, eventsData);

    const questModelController = await QuestModelController.byContractAddress(contractAddress);
    const questDisputeModelController = await QuestDisputeModelController.byContractAddress(contractAddress);

    const [questArbitrationReworkEvent, isCreated] = await QuestArbitrationReworkEvent.findOrCreate({
      where: {
        transactionHash,
        network: this.network,
      },
      defaults: {
        timestamp,
        contractAddress,
        transactionHash,
        network: this.network,
        blockNumber: eventsData.blockNumber,
        status: QuestArbitrationReworkStatus.Successfully,
      }
    });

    if (!isCreated) {
      Logger.warn('Arbitration rework event handler: event "%s" is skipped because is has already been created',
        eventsData.event
      );

      return;
    }

    await this.updateBlockViewHeight(eventsData.blockNumber);

    if (!questDisputeModelController) {
      Logger.warn('Arbitration rework event handler: event "%s" is skipped because dispute entity not found',
        eventsData.event
      );

      return questArbitrationReworkEvent.update({ status: QuestArbitrationReworkStatus.DisputeNotFound });
    }

    if (!questDisputeModelController.statusDoesMatch(DisputeStatus.InProgress)) {
      Logger.warn('Arbitration rework event handler: event "%s" is skipped because dispute status does not match',
        eventsData.event
      );

      return questArbitrationReworkEvent.update({ status: QuestArbitrationReworkStatus.DisputeStatusDoesNotMatch });
    }

    if (!questModelController) {
      Logger.warn('Arbitration rework work event handler: event "%s" is skipped because quest entity not found',
        eventsData.event
      )

      return questArbitrationReworkEvent.update({ status: QuestArbitrationReworkStatus.QuestNotFound });
    }

    await questModelController.restartQuest();
    await questDisputeModelController.closeDispute(DisputeDecision.Rework, timestamp);

    await this.clients.notificationsBroker.sendNotification({
      recipients: [questModelController.quest.userId, questModelController.quest.assignedWorkerId],
      action: QuestNotificationActions.DisputeDecision,
      data: questDisputeModelController.dispute,
    });
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
