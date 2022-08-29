import {BlocksRange} from "../../../types";
import {ITask} from "./task-queue.interfaces";
import {Log} from "@ethersproject/abstract-provider/src.ts/index";

/**
 *    Task/TasksExecutor utils types.
 *  Used in clients/server that generate tasks
 *    and give them to the task executor.
 */
export type TaskKey = string;

export type TaskPriority =
  | 1
  | 2
  | 3

export enum TaskTypes {
  GetLogs = 'GetLogs',
}

export enum TaskCompletionStatus {
  Error = -1,
  Completed = 0,
  InProgress = 1,
}

export type TaskExecutorOptions = {
  concurrency: number,
  intervalInMs: number,
}

export type TaskPool = {
  task: ITask,
  options: { priority: TaskPriority },
}

/**
 *          GetLogs Tasks types.
 * Task to get logs for an array of addresses.
 */
export type TaskGetLogsResult = {
  logs: Log[],
  maxBlockHeightViewed: number,
}

export type GetLogsTaskPayload = {
  blocksRange: BlocksRange,
  addresses: string | string[],
}

export type GetLogsOptions = {
  /**
   * Get logs by step range.
   * (from, from + stepsRange)
   */
  stepsRange: number,
}

export type TaskFactoryOptions = {
  getLogs: GetLogsOptions
}
