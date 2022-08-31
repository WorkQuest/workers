import {Log} from "@ethersproject/abstract-provider/src.ts/index";
import {TaskRouterRequest} from "../../middleware/message-oriented/message-queue.types";
import {IRouterServer} from "../../middleware/message-oriented/message-queue.interfaces";
import {ILogsFetcherWorker} from "../../middleware/utilis/blockchain/blockchain.interfaces";
import {TaskCompletionStatus, TaskTypes} from "../../middleware/utilis/task-queue/task-queue.types";
import {ITask, ITaskExecutor, ITaskFactory} from "../../middleware/utilis/task-queue/task-queue.interfaces";

/**
 * (old)
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



export class BlockchainNewLogNotificationsServer {
  /**
   * Key - task key (see ITask).
   * Value - metadata.
   */
  protected readonly tasksRunningTable: Map<string, {clientName: string, taskType: TaskTypes}>;

  constructor(
    protected readonly routerServer: IRouterServer,
    protected readonly logsFetcherWorker: ILogsFetcherWorker,
  ) {
    this.tasksRunningTable = new Map<string, {clientName: string, taskType: TaskTypes}>();

    this.logsFetcherWorker.on('logs', this.onNewLogHandler.bind(this));
  }

  protected async onNewLogHandler(logs: Log[]) {
    await this.routerServer.notifyEveryoneAboutNewLogs(logs);
  }

  public start() {
    this.logsFetcherWorker.startFetcher();
  }
}
