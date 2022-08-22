import {Log} from "@ethersproject/abstract-provider/src.ts/index";
import {TaskRouterRequest} from "../../middleware/message-oriented/message-queue.types";
import {IRouterServer} from "../../middleware/message-oriented/message-queue.interfaces";
import {ILogsFetcherWorker} from "../../middleware/utilis/blockchain/blockchain.interfaces";
import {TaskCompletionStatus, TaskTypes} from "../../middleware/utilis/task-queue/task-queue.types";
import {ITask, ITaskExecutor, ITaskFactory} from "../../middleware/utilis/task-queue/task-queue.interfaces";

/**
 * System for collecting logs and sending to all listeners (workers).
 * Sending logs at the request of clients (workers).
 *
 * protected readonly routerServer - Takes responsibility for sending logs to all listeners
 *    and accepts / sends tasks (sending logs on request).
 *
 * protected readonly taskExecutor - Execution of tasks from clients (workers).
 *    Execution priority, requests in the repository, requests per second,
 *    queues, etc. - this is all that is hidden in the interface.
 *
 *
 * protected readonly logsFetcherWorker - Collects all logs directly from the blockchain.
 *    Notifies everyone who subscribes about new logs.
 */
export class BlockchainLogsServer {
  /**
   * Key - task key (see ITask).
   * Value - metadata.
   */
  protected readonly tasksRunningTable: Map<string, {clientName: string, taskType: TaskTypes}>;

  constructor(
    protected readonly routerServer: IRouterServer,
    protected readonly taskFactory: ITaskFactory,
    protected readonly taskExecutor: ITaskExecutor,
    protected readonly logsFetcherWorker: ILogsFetcherWorker,
  ) {
    this.tasksRunningTable = new Map<string, {clientName: string, taskType: TaskTypes}>();

    this.logsFetcherWorker.on('logs', this.onNewLogHandler.bind(this));
    this.routerServer.on('task-request', this.onTaskExecutionRequest.bind(this));
    this.taskExecutor.on('completed-tasks', this.onCompletedTasksHandler.bind(this));
  }

  protected onTaskExecutionRequest(taskRequest: TaskRouterRequest) {
    const task = this.taskFactory.create(
      taskRequest.task,
      taskRequest.key,
      taskRequest.payload,
    );

    console.log(
      "Add task: key =" + task.taskKey +
      " who =" + this.routerServer['network'],
    );
    this.taskExecutor.addTask(task, { priority: taskRequest.priority });

    this.tasksRunningTable.set(task.taskKey, {
      taskType: taskRequest.task,
      clientName: taskRequest.clientName,
    });
  }

  protected async onCompletedTasksHandler(tasks: ITask[]) {
    for (const task of tasks) {
      if (task.getStatus() === TaskCompletionStatus.Error) {
        console.error('Task with error: ' + task.taskKey);
        continue;
      }
      if (task.getStatus() === TaskCompletionStatus.InProgress) {
        console.error('Task in Progress: ' + task.taskKey);
        continue;
      }

      const taskResult = task.getExecutionResult();
      const taskMetadata = this.tasksRunningTable.get(task.taskKey);

      this.tasksRunningTable.delete(task.taskKey);

      if (taskMetadata.taskType === TaskTypes.GetLogs) {
        await this.routerServer.sendExecutedTaskGetLogs(taskMetadata.clientName, {
          key: task.taskKey,
          logs: taskResult.logs,
          maxBlockHeightViewed: taskResult.maxBlockHeightViewed,
        })
      }
    }
  }

  protected async onNewLogHandler(logs: Log[]) {
    await this.routerServer.notifyEveryoneAboutNewLogs(logs);
  }

  public async start() {
    this.taskExecutor.startExecute();
    // this.logsFetcherWorker.startFetcher();
  }
}
