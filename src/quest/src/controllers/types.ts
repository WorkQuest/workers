import { IController } from '../../../types';

export enum QuestEvent {
  WorkQuestCreated = 'WorkQuestCreated',                /** (Only for view) Replicates the event from the quest factory. QuestStatus.Pending -> QuestStatus.Recruitment. */
  Received = 'Received',                                /** (Only for view) When transferring WUSD to the quest contract.                                                */

  JobCancelled = 'JobCancelled',                        /** Employer canceled quest. QuestStatus. */
  JobEdited = 'JobEdited',                              /** Employer edited quest */
  JobDeclined = 'JobDeclined',                          /** DELETE (old) */

  Assigned = 'Assigned',                                /** Employer assigned worker. QuestStatus.Recruitment -> QuestStatus.WaitingForConfirmFromWorkerOnAssign.                                         */
  JobStarted = 'JobStarted',                            /** After confirming the worker - the quest start. QuestStatus.WorkerAcceptedQuestAssignment -> QuestStatus.ExecutionOfWork.                      */
  JobDone = 'JobDone',                                  /** Worker completed the quest. Waiting for employer confirmation. QuestStatus.ExecutionOfWork -> QuestStatus.WaitingForEmployerConfirmationWork. */
  JobFinished = 'JobFinished',                          /** The employer confirmed the completed quest. QuestStatus.WaitingForEmployerConfirmationWork -> QuestStatus.Completed                           */

  ArbitrationAcceptWork = 'ArbitrationAcceptWork',      /** The admin accept completed work. */
  ArbitrationDecreaseCost = 'ArbitrationDecreaseCost',  /** The admin decrease quest cost for worker. */
  ArbitrationRejectWork = 'ArbitrationRejectWork',      /** The admin reject completed work. */
  ArbitrationRework = 'ArbitrationRework',              /** The admin forced to redo the work. */
  ArbitrationStarted = 'ArbitrationStarted'             /** Dispute started. */
}

export enum QuestNotificationActions {
  QuestStatusUpdated = 'QuestStatusUpdated',
  QuestEdited = 'QuestEditedOnContract'
}

export {
  IController,
}
