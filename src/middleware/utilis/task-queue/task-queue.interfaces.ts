import {
  TaskKey,
  TaskTypes,
  TaskPriority,
  TaskGetLogsResult,
  GetLogsTaskPayload,
  TaskCompletionStatus,
} from "./task-queue.types";

/**
 *          Utils to work with tasks.
 * Includes a pool of tasks with priorities.
 *
 * Task has a state (see enum TaskCompletionStatus) and
 *    can be executed in several stages or executed after
 *    the first execution.
 */
export interface ITask {
  readonly taskKey: TaskKey;

  getExecutionResult(): any;
  getStatus(): TaskCompletionStatus;
  execute(): Promise<TaskCompletionStatus>;
}

export interface ITaskGetLogs extends ITask {
  getExecutionResult(): TaskGetLogsResult;
}

export interface ITaskFactory {
  create(type: TaskTypes.GetLogs, taskKey: TaskKey, payload: GetLogsTaskPayload): Promise<ITask>;
}

export interface ITaskExecutor {
  on(type: 'completed-tasks', callback: (tasks: ITask[]) => void);

  addTask(task: ITask, options: { priority: TaskPriority }): void;

  startExecute();
}
