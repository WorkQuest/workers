import Web3 from "web3";
import {col, fn, Op} from "sequelize";
import {EventData} from "web3-eth-contract";
import {addJob} from "../../../utils/scheduler";
import {ILogger, IQuestCacheProvider} from "../providers/types";
import {UserModelController} from "./models/UserModelController";
import {QuestModelController} from "./models/QuestModelController";
import {updateQuestsStatisticJob} from "../../jobs/updateQuestsStatistic";
import {QuestChatModelController} from "./models/QuestChatModelController";
import {IContractProvider, IContractListenerProvider} from "../../../types";
import {INotificationSenderClient, IBridgeBetweenWorkers} from "../../../middleware";
import {addUpdateReviewStatisticsJob} from "../../jobs/updateReviewStatistics";
import {QuestDisputeModelController} from "./models/QuestDisputeModelController";
import {QuestResponsesModelController} from "./models/QuestResponsesModelController";
import {IController, QuestEvent, QuestNotificationActions, StatisticPayload} from "./types";
import {incrementAdminDisputeStatisticJob} from "../../jobs/incrementAdminDisputeStatistic";
import {
  UserRole,
  QuestStatus,
  DisputeStatus,
  QuestsResponse,
  QuestBlockInfo,
  DisputeDecision,
  QuestJobDoneEvent,
  QuestAssignedEvent,
  QuestJobDoneStatus,
  BlockchainNetworks,
  QuestJobEditedEvent,
  QuestsResponseStatus,
  QuestJobStartedEvent,
  QuestJobEditedStatus,
  QuestJobFinishedEvent,
  QuestJobCancelledEvent,
  QuestAssignedEventStatus,
  QuestJobStartedEventStatus,
  QuestJobFinishedEventStatus,
  QuestArbitrationReworkEvent,
  QuestArbitrationReworkStatus,
  QuestArbitrationStartedEvent,
  QuestJobCancelledEventStatus,
  QuestsPlatformStatisticFields,
  QuestArbitrationStartedStatus,
  DisputesPlatformStatisticFields,
  QuestArbitrationRejectWorkEvent,
  QuestArbitrationAcceptWorkEvent,
  QuestArbitrationAcceptWorkStatus,
  QuestArbitrationRejectWorkStatus,
} from "@workquest/database-models/lib/models";

export class QuestController implements IController {
  constructor(
    public readonly web3: Web3,
    protected readonly Logger: ILogger,
    public readonly network: BlockchainNetworks,
    public readonly contractProvider: IContractProvider,
    public readonly notificationClient: INotificationClient,
    public readonly questCacheProvider: IQuestCacheProvider,
    public readonly bridgeBetweenWorkers: IBridgeBetweenWorkers,
  ) {
  }

  public async onEvent(eventsData: EventData) {
    this.Logger.info('Event handler: name %s, block number %s, address %s',
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

  private writeQuestActionStatistics(payload: StatisticPayload) {
    if (payload.oldStatus) {
      return Promise.all([
        addJob('writeActionStatistics', {
          incrementField: payload.incrementField,
          statistic: 'quest',
          type: 'increment'
        }),
        addJob('writeActionStatistics', {
          incrementField: QuestsPlatformStatisticFields[QuestStatus[payload.oldStatus]],
          statistic: 'quest',
          type: 'decrement'
        }),
      ]);
    }

    return addJob('writeActionStatistics', {
      incrementField: payload.incrementField,
      statistic: 'quest',
      type: 'increment'
    });
  }

  private writeDisputeActionStatistics(payload: StatisticPayload) {
    if (payload.oldStatus) {
      return Promise.all([
        addJob('writeActionStatistics', {
          incrementField: payload.incrementField,
          statistic: 'dispute',
          type: 'increment'
        }),
        addJob('writeActionStatistics', {
          incrementField: DisputesPlatformStatisticFields[DisputeStatus[payload.oldStatus]],
          statistic: 'dispute',
          type: 'decrement'
        }),
      ]);
    }

    return addJob('writeActionStatistics', {
      incrementField: payload.incrementField,
      statistic: 'dispute',
      type: 'increment'
    });
  }

  public async getLastCollectedBlock(): Promise<number> {
    const [{ lastParsedBlock }, ] = await QuestBlockInfo.findOrCreate({
      where: { network: this.network },
      defaults: {
        network: this.network,
        lastParsedBlock: this.contractProvider.eventViewingHeight,
      },
    });

    this.Logger.debug('Last collected block: "%s"', lastParsedBlock);

    return lastParsedBlock;
  }

  protected updateBlockViewHeight(blockHeight: number): Promise<any> {
    this.Logger.debug('Update blocks: new block height "%s"', blockHeight);

    return QuestBlockInfo.update({ lastParsedBlock: blockHeight }, {
      where: {
        network: this.network,
        lastParsedBlock: { [Op.lt]: blockHeight },
      }
    });
  }

  protected async jobEditedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.web3.eth.getBlock(eventsData.blockNumber);

    const contractAddress = eventsData.address.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    const questModelController = await QuestModelController.byContractAddress(contractAddress);

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
      this.Logger.warn('Job edited event handler: event "%s" handling is skipped because it has already been created',
        eventsData.event,
      );

      return;
    }

    await this.updateBlockViewHeight(eventsData.blockNumber);

    if (!questModelController) {
      this.Logger.warn('Job edited event handler: event "%s" handling is skipped because quest entity not found',
        eventsData.event,
      );

      return questJobEditedEvent.update({ status: QuestJobEditedStatus.QuestEntityNotFound });
    }
    if (!questModelController.statusDoesMatch(
      QuestStatus.Recruitment,
    )) {
      this.Logger.warn('Job edited event handler: event "%s" handling is skipped because quest status does not match',
        eventsData.event,
      );

      return questJobEditedEvent.update({ status: QuestJobEditedStatus.QuestStatusDoesNotMatch });
    }

    await questModelController.editQuest({
      price: eventsData.returnValues.cost,
    });

    const questsResponseWorkerIds = await QuestsResponse.unscoped().findAll({
      attributes: [
        [fn('array_agg', col('"workerId"')), 'workerIds'],
        'type'
      ],
      where: {
        questId: questModelController.quest.id,
        status: QuestsResponseStatus.Open,
      },
      group: ['type'],
      order: [['type', 'ASC']]
    });

    if (questsResponseWorkerIds.length !== 0) {
      for (const response of questsResponseWorkerIds) {
        await this.notificationClient.notify({
          action: QuestNotificationActions.QuestEdited,
          recipients: response.getDataValue('workerIds'),
          data: { ...questModelController.quest.toJSON(), responseType: response.type },
        });
      }
    }

    await this.notificationClient.notify({
      recipients: [questModelController.quest.userId],
      action: QuestNotificationActions.QuestEdited,
      data: questModelController.quest,
    });
  }

  protected async jobCancelledEventHandler(eventsData: EventData) {
    const { timestamp } = await this.web3.eth.getBlock(eventsData.blockNumber);

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
      this.Logger.warn('Job cancelled event handler: event "%s" handling is skipped because it has already been created',
        eventsData.event,
      );

      return;
    }

    await this.updateBlockViewHeight(eventsData.blockNumber);

    if (!questModelController) {
      this.Logger.warn('Job cancelled event handler: event "%s" handling is skipped because quest entity not found',
        eventsData.event,
      );

      return questJobCancelledEvent.update({ status: QuestJobCancelledEventStatus.QuestEntityNotFound });
    }
    if (!questModelController.statusDoesMatch(
      QuestStatus.Recruitment,
    )) {
      this.Logger.warn('Job cancelled event handler: event "%s" handling is skipped because quest status does not match',
        eventsData.event,
      );

      return questJobCancelledEvent.update({ status: QuestJobCancelledEventStatus.QuestStatusDoesNotMatch });
    }

    await this.writeQuestActionStatistics({
      incrementField: QuestsPlatformStatisticFields.Closed,
      oldStatus: questModelController.quest.status,
    });

    await Promise.all([
      questModelController.closeQuest(),
      questChatModelController.closeAllChats(),
      questResponsesModelController.closeAllResponses(),
      this.questCacheProvider.remove(contractAddress),
    ]);

    await this.notificationClient.notify({
      recipients: [questModelController.quest.userId],
      action: QuestNotificationActions.QuestStatusUpdated,
      data: questModelController.quest
    });
  }

  protected async assignedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.web3.eth.getBlock(eventsData.blockNumber);

    const contractAddress = eventsData.address.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();
    const workerAddress = eventsData.returnValues.worker.toLowerCase();

    this.Logger.debug('Assigned event handler: timestamp "%s", event data %o', timestamp, eventsData);

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
      this.Logger.warn('Assigned event handler: event "%s" handling is skipped because it has already been created',
        eventsData.event,
      );

      return;
    }

    await this.updateBlockViewHeight(eventsData.blockNumber);

    if (!workerModelController || !questModelController) {
      this.Logger.warn('Assigned event handler (worker address: "%s") event "%s" handling is skipped because worker or quest entity not found',
        workerAddress,
        eventsData.event,
      );

      return questAssignedEvent.update({ status: QuestAssignedEventStatus.WorkerOrQuestEntityNotFound });
    }
    if (!questModelController.statusDoesMatch(
      QuestStatus.Recruitment,
      QuestStatus.WaitingForConfirmFromWorkerOnAssign,
    )) {
      this.Logger.warn('Assigned event handler (worker address: "%s") event "%s" handling is skipped because quest status does not match',
        workerAddress,
        eventsData.event,
      );

      return questAssignedEvent.update({ status: QuestAssignedEventStatus.QuestStatusDoesNotMatch });
    }

    await this.writeQuestActionStatistics({
      incrementField: QuestsPlatformStatisticFields.WaitingForConfirmFromWorkerOnAssign,
      oldStatus: questModelController.quest.status,
    });

    await questModelController.assignWorkerOnQuest(workerModelController.user);
    await this.notificationClient.notify({
      recipients: [questModelController.quest.userId, workerModelController.user.id],
      action: QuestNotificationActions.QuestStatusUpdated,
      data: questModelController.quest,
    });
  }

  protected async jobStartedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.web3.eth.getBlock(eventsData.blockNumber);

    const contractAddress = eventsData.address.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    this.Logger.debug('Job started event handler: timestamp "%s", event data %o', timestamp, eventsData);

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
      this.Logger.warn('Job started event handler: event "%s" handling is skipped because it has already been created',
        eventsData.event
      );

      return;
    }

    await this.updateBlockViewHeight(eventsData.blockNumber);

    if (!questModelController) {
      this.Logger.warn('Job started event handler: event "%s" handling is skipped because quest entity not found',
        eventsData.event,
      );

      return questJobStartedEvent.update({ status: QuestJobStartedEventStatus.QuestEntityNotFound });
    }
    if (!questModelController.statusDoesMatch(
      QuestStatus.WaitingForConfirmFromWorkerOnAssign,
    )) {
      this.Logger.warn('Job started event handler: event "%s" handling is skipped because quest status does not match',
        eventsData.event,
      );

      return questJobStartedEvent.update({ status: QuestJobStartedEventStatus.QuestStatusDoesNotMatch });
    }

    await this.writeQuestActionStatistics({
      incrementField: QuestsPlatformStatisticFields.ExecutionOfWork,
      oldStatus: questModelController.quest.status,
    });

    await Promise.all([
      questModelController.startQuest(),
      questResponsesModelController.closeAllWorkingResponses(),
      questChatModelController.closeAllWorkChatsExceptAssignedWorker(),
    ]);

    await this.notificationClient.notify({
      recipients: [questModelController.quest.assignedWorkerId, questModelController.quest.userId],
      action: QuestNotificationActions.QuestStatusUpdated,
      data: questModelController.quest
    });
  }

  protected async jobDoneEventHandler(eventsData: EventData) {
    const { timestamp } = await this.web3.eth.getBlock(eventsData.blockNumber);

    const contractAddress = eventsData.address.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    this.Logger.debug('Job done event handler: timestamp "%s", event data %o', timestamp, eventsData);

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
      this.Logger.warn('Job done event handler: event "%s" handling is skipped because it has already been created',
        eventsData.event
      );

      return;
    }

    await this.updateBlockViewHeight(eventsData.blockNumber);

    if (!questModelController) {
      this.Logger.warn('Job done event handler: event "%s" handling is skipped because quest entity not found',
        eventsData.event,
      );

      return questJobDoneEvent.update({ status: QuestJobDoneStatus.QuestEntityNotFound });
    }
    if (!questModelController.statusDoesMatch(
      QuestStatus.ExecutionOfWork,
    )) {
      this.Logger.warn('Job done event handler: event "%s" handling is skipped because quest status does not match',
        eventsData.event,
      );

      return questJobDoneEvent.update({ status: QuestJobDoneStatus.QuestStatusDoesNotMatch });
    }

    await this.writeQuestActionStatistics({
      incrementField: QuestsPlatformStatisticFields.WaitingForEmployerConfirmationWork,
      oldStatus: questModelController.quest.status,
    });

    await questModelController.finishWork();
    await this.notificationClient.notify({
      recipients: [questModelController.quest.assignedWorkerId, questModelController.quest.userId],
      action: QuestNotificationActions.QuestStatusUpdated,
      data: questModelController.quest
    });
  }

  protected async jobFinishedEventHandler(eventsData: EventData) {
    const { timestamp } = await this.web3.eth.getBlock(eventsData.blockNumber);

    const contractAddress = eventsData.address.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    this.Logger.debug('Job finished event handler: timestamp "%s", event data %o', timestamp, eventsData);

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
      this.Logger.warn('Job finished event handler: event "%s" handling is skipped because it has already been created',
        eventsData.event
      );

      return;
    }

    await this.updateBlockViewHeight(eventsData.blockNumber);

    if (!questModelController) {
      this.Logger.warn('Job finished event handler: event "%s" handling is skipped because quest entity not found',
        eventsData.event,
      );

      return questJobFinishedEvent.update({ status: QuestJobFinishedEventStatus.QuestEntityNotFound });
    }
    if (!questModelController.statusDoesMatch(
      QuestStatus.WaitingForEmployerConfirmationWork,
    )) {
      this.Logger.warn('Job finished event handler: event "%s" handling is skipped because quest status does not match',
        eventsData.event,
      );

      return questJobFinishedEvent.update({ status: QuestJobFinishedEventStatus.QuestStatusDoesNotMatch });
    }

    await this.writeQuestActionStatistics({
      incrementField: QuestsPlatformStatisticFields.Completed,
      oldStatus: questModelController.quest.status,
    });

    await Promise.all([
      questModelController.completeQuest(),
      this.questCacheProvider.remove(contractAddress),
    ]);

    await Promise.all([
      addUpdateReviewStatisticsJob({ userId: questModelController.quest.userId }),
      addUpdateReviewStatisticsJob({ userId: questModelController.quest.assignedWorkerId }),
      updateQuestsStatisticJob({ userId: questModelController.quest.userId, role: UserRole.Employer }),
      updateQuestsStatisticJob({ userId: questModelController.quest.assignedWorkerId, role: UserRole.Worker }),

      this.bridgeBetweenWorkers.sendMessage('referral', 'check-block', { blockNumber: eventsData.blockNumber }),

      this.notificationClient.notify({
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

    this.Logger.debug('Arbitration started event handler: timestamp "%s", event data %o', timestamp, eventsData);

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
      this.Logger.warn('Arbitration started event handler: event "%s" is skipped because is has already been created',
        eventsData.event
      );

      return;
    }

    await this.updateBlockViewHeight(eventsData.blockNumber);

    if (!questDisputeModelController) {
      this.Logger.warn('Arbitration started event handler: event "%s" is skipped because dispute entity not found',
        eventsData.event
      );

      return questArbitrationStartedEvent.update({ status: QuestArbitrationStartedStatus.DisputeNotFound });
    }

    if (!questDisputeModelController.statusDoesMatch(DisputeStatus.Pending)) {
      this.Logger.warn('Arbitration started event handler: event "%s" is skipped because dispute status does not match',
        eventsData.event
      );

      return questArbitrationStartedEvent.update({ status: QuestArbitrationStartedStatus.DisputeStatusDoesNotMatch });
    }

    await this.writeQuestActionStatistics({
      incrementField: QuestsPlatformStatisticFields.Dispute,
      oldStatus: questModelController.quest.status,
    });
    await this.writeDisputeActionStatistics({
      incrementField: DisputesPlatformStatisticFields.Created,
      oldStatus: questDisputeModelController.dispute.status
    });

    await questModelController.freezeQuestForDispute();
    await questDisputeModelController.confirmDispute();

    await this.notificationClient.notify({
      recipients: [questModelController.quest.userId, questModelController.quest.assignedWorkerId],
      action: QuestNotificationActions.OpenDispute,
      data: questDisputeModelController.dispute,
    });
  }

  protected async arbitrationAcceptWorkEventHandler(eventsData: EventData) {
    const timestamp = eventsData.returnValues.timestamp;
    const contractAddress = eventsData.address.toLowerCase();
    const transactionHash = eventsData.transactionHash.toLowerCase();

    this.Logger.debug('Arbitration accept work event handler: timestamp "%s", event data %o', timestamp, eventsData);

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
      this.Logger.warn('Arbitration accept work event handler: event "%s" is skipped because is has already been created',
        eventsData.event
      );

      return;
    }

    await this.updateBlockViewHeight(eventsData.blockNumber);

    if (!questDisputeModelController) {
      this.Logger.warn('Arbitration accept work event handler: event "%s" is skipped because dispute entity not found',
        eventsData.event
      );

      return questArbitrationAcceptWorkEvent.update({ status: QuestArbitrationAcceptWorkStatus.DisputeNotFound });
    }

    if (!questDisputeModelController.statusDoesMatch(DisputeStatus.PendingClosed)) {
      this.Logger.warn('Arbitration accept work event handler: event "%s" is skipped because dispute status does not match',
        eventsData.event
      );

      return questArbitrationAcceptWorkEvent.update({ status: QuestArbitrationAcceptWorkStatus.DisputeStatusDoesNotMatch });
    }

    if (!questModelController) {
      this.Logger.warn('Arbitration accept work event handler: event "%s" is skipped because quest entity not found',
        eventsData.event
      )

      return questArbitrationAcceptWorkEvent.update({ status: QuestArbitrationAcceptWorkStatus.QuestNotFound });
    }

    await this.writeDisputeActionStatistics({
      incrementField: DisputesPlatformStatisticFields.Closed,
      oldStatus: questDisputeModelController.dispute.status
    });

    await questModelController.completeQuest();
    await questDisputeModelController.closeDispute(DisputeDecision.AcceptWork, timestamp);
    await questChatModelController.closeAllChats();

    await this.questCacheProvider.remove(contractAddress);

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
      this.notificationClient.notify({
        recipients: [questModelController.quest.assignedWorkerId, questModelController.quest.userId],
        action: QuestNotificationActions.QuestStatusUpdated,
        data: questModelController.quest
      }),
      this.notificationClient.notify({
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

    this.Logger.debug('Arbitration reject work event handler: timestamp "%s", event data %o', timestamp, eventsData);

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
      this.Logger.warn('Arbitration reject work event handler: event "%s" is skipped because is has already been created',
        eventsData.event
      );

      return;
    }

    await this.updateBlockViewHeight(eventsData.blockNumber);

    if (!questDisputeModelController) {
      this.Logger.warn('Arbitration reject work event handler: event "%s" is skipped because dispute entity not found',
        eventsData.event
      );

      return questArbitrationRejectWorkEvent.update({ status: QuestArbitrationRejectWorkStatus.DisputeNotFound });
    }

    if (!questDisputeModelController.statusDoesMatch(DisputeStatus.PendingClosed)) {
      this.Logger.warn('Arbitration reject work event handler: event "%s" is skipped because dispute status does not match',
        eventsData.event
      );

      return questArbitrationRejectWorkEvent.update({ status: QuestArbitrationRejectWorkStatus.DisputeStatusDoesNotMatch });
    }

    if (!questModelController) {
      this.Logger.warn('Arbitration reject work event handler: event "%s" is skipped because quest entity not found',
        eventsData.event
      )

      return questArbitrationRejectWorkEvent.update({ status: QuestArbitrationRejectWorkStatus.QuestNotFound });
    }

    await this.writeDisputeActionStatistics({
      incrementField: DisputesPlatformStatisticFields.Closed,
      oldStatus: questDisputeModelController.dispute.status
    });

    await questModelController.closeQuest();
    await questDisputeModelController.closeDispute(DisputeDecision.RejectWork, timestamp);
    await questChatModelController.closeAllChats();

    await this.questCacheProvider.remove(contractAddress);

    await Promise.all([
      incrementAdminDisputeStatisticJob({
        adminId: questDisputeModelController.dispute.assignedAdminId,
        resolutionTimeInSeconds: (
          questDisputeModelController.dispute.resolvedAt.getTime() -
          questDisputeModelController.dispute.acceptedAt.getTime()
        ) / 1000,
      }),
      this.notificationClient.notify({
        recipients: [questModelController.quest.assignedWorkerId, questModelController.quest.userId],
        action: QuestNotificationActions.QuestStatusUpdated,
        data: questModelController.quest
      }),
      this.notificationClient.notify({
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

    this.Logger.debug('Arbitration rework event handler: timestamp "%s", event data %o', timestamp, eventsData);

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
      this.Logger.warn('Arbitration rework event handler: event "%s" is skipped because is has already been created',
        eventsData.event
      );

      return;
    }

    await this.updateBlockViewHeight(eventsData.blockNumber);

    if (!questDisputeModelController) {
      this.Logger.warn('Arbitration rework event handler: event "%s" is skipped because dispute entity not found',
        eventsData.event
      );

      return questArbitrationReworkEvent.update({ status: QuestArbitrationReworkStatus.DisputeNotFound });
    }

    if (!questDisputeModelController.statusDoesMatch(DisputeStatus.PendingClosed)) {
      this.Logger.warn('Arbitration rework event handler: event "%s" is skipped because dispute status does not match',
        eventsData.event
      );

      return questArbitrationReworkEvent.update({ status: QuestArbitrationReworkStatus.DisputeStatusDoesNotMatch });
    }

    if (!questModelController) {
      this.Logger.warn('Arbitration rework work event handler: event "%s" is skipped because quest entity not found',
        eventsData.event
      )

      return questArbitrationReworkEvent.update({ status: QuestArbitrationReworkStatus.QuestNotFound });
    }

    await this.writeDisputeActionStatistics({
      incrementField: DisputesPlatformStatisticFields.Closed,
      oldStatus: questDisputeModelController.dispute.status
    });

    await questModelController.restartQuest();
    await questDisputeModelController.closeDispute(DisputeDecision.Rework, timestamp);

    await this.notificationClient.notify({
      recipients: [questModelController.quest.userId, questModelController.quest.assignedWorkerId],
      action: QuestNotificationActions.DisputeDecision,
      data: questDisputeModelController.dispute,
    });
  }

  public async collectAllUncollectedEvents(fromBlockNumber: number) {
    this.Logger.info('Start collecting all uncollected events from block number: %s.', fromBlockNumber);

    const { events, error, lastBlockNumber } = await this.contractProvider.getEvents(fromBlockNumber);

    for (const event of events) {
      try {
        await this.onEvent(event);
      } catch (err) {
        this.Logger.error(err, 'Event processing ended with error');

        throw err;
      }
    }

    await this.updateBlockViewHeight(lastBlockNumber);

    if (error) {
      throw error;
    }
  }

  public async syncBlocks() {
    const lastParsedBlock = await this.getLastCollectedBlock();

    await this.collectAllUncollectedEvents(lastParsedBlock);
  }

  public async start() {
    await this.collectAllUncollectedEvents(
      await this.getLastCollectedBlock()
    );
  }
}

export class QuestListenerController extends QuestController {
  constructor(
    public readonly web3: Web3,
    protected readonly Logger: ILogger,
    public readonly network: BlockchainNetworks,
    public readonly notificationClient: INotificationClient,
    public readonly questCacheProvider: IQuestCacheProvider,
    public readonly contractProvider: IContractListenerProvider,
    public readonly bridgeBetweenWorkers: IBridgeBetweenWorkers,
  ) {
    super(
      web3,
      Logger,
      network,
      contractProvider,
      notificationClient,
      questCacheProvider,
      bridgeBetweenWorkers,
    );
  }

  public async start() {
    await super.start();

    this.contractProvider.startListener(
      await this.getLastCollectedBlock()
    );

    this.contractProvider.on('events', (async (eventData) => {
      await this.onEvent(eventData);
    }));
  }
}
