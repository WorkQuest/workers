import {Clients, IContractProvider} from "../providers/types";
import {BlockchainNetworks} from "@workquest/database-models/lib/models";

export enum QuestEvent {
  WorkQuestCreated = 'WorkQuestCreated',      /** (Only for view) Replicates the event from the quest factory. QuestStatus.Pending -> QuestStatus.Recruitment. */
  Received = 'Received',                      /** (Only for view) When transferring WUSD to the quest contract.                                                */

  JobCancelled = 'JobCancelled',              /** Employer canceled quest. QuestStatus. */
  JobEdited = 'JobEdited',                    /** Employer edited quest */
  JobDeclined = 'JobDeclined',                /** DELETE */

  Assigned = 'Assigned',                      /** Employer assigned worker. QuestStatus.Recruitment -> QuestStatus.WaitingForConfirmFromWorkerOnAssign.                                         */
  JobStarted = 'JobStarted',                  /** After confirming the worker - the quest start. QuestStatus.WorkerAcceptedQuestAssignment -> QuestStatus.ExecutionOfWork.                      */
  JobFinished = 'JobFinished',                /** Worker completed the quest. Waiting for employer confirmation. QuestStatus.ExecutionOfWork -> QuestStatus.WaitingForEmployerConfirmationWork. */
  JobDone = 'JobDone',                        /** The employer confirmed the completed quest. QuestStatus.WaitingForEmployerConfirmationWork -> QuestStatus.Completed                           */

  // ArbitrationAcceptWork
  // ArbitrationDecreaseCost
  // ArbitrationRejectWork
  // ArbitrationRework
  // ArbitrationStarted
}

export interface IController {
  readonly clients: Clients;
  readonly network: BlockchainNetworks;
  readonly contractProvider: IContractProvider;

  collectAllUncollectedEvents(fromBlockNumber: number): Promise<void>;
}
