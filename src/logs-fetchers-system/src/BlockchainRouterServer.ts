import {Log} from "@ethersproject/abstract-provider/src.ts/index";
import {TaskRouterRequest} from "../../middleware/message-oriented/message-queue.types";
import {IRouterServer} from "../../middleware/message-oriented/message-queue.interfaces";
import {ILogsFetcherWorker} from "../../middleware/utilis/blockchain/blockchain.interfaces";
import {ITask, ITaskExecutor, ITaskFactory} from "../../middleware/utilis/task-queue/task-queue.interfaces";


export class BlockchainRouterServer {
  constructor(
    protected readonly routerServer: IRouterServer,
    protected readonly taskFactory: ITaskFactory,
    protected readonly taskExecutor: ITaskExecutor,
    protected readonly logsFetcherWorker: ILogsFetcherWorker,
  ) {
    this.routerServer.on('task-request', )
    this.logsFetcherWorker.on('logs', this.onNewLogHandler.bind(this));
    this.taskExecutor.on('completed-tasks', this.onCompletedTasksHandler.bind(this));
  }

  protected onR(taskRequest: TaskRouterRequest) {

  }

  protected onCompletedTasksHandler(tasks: ITask[]) {
    this.routerServer.sendExecutedTaskGetLogs(tasks.)
  }

  protected async onNewLogHandler(logs: Log[]) {
    await this.routerServer.notifyEveryoneAboutNewLogs(logs);
  }

  public async start() {
    this.taskExecutor.startExecute();
    this.logsFetcherWorker.startFetcher();
  }
}
