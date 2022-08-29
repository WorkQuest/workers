import {GetLogsTask} from "./GetLogsTask";
import {LoggerFactory} from "../../logging";
import {ITask, ITaskFactory} from "./task-queue.interfaces";
import {IBlockchainRepository} from "../../repository/repository.interfaces";
import {
  TaskKey,
  TaskTypes,
  GetLogsTaskPayload,
  TaskFactoryOptions,
} from "./task-queue.types";

export class TasksFactory implements ITaskFactory {
  constructor(
    protected readonly options: TaskFactoryOptions,
    protected readonly blockchainRepository: IBlockchainRepository,
  ) {
  }

  protected async createGetLogsTask(taskKey: TaskKey, payload: GetLogsTaskPayload): Promise<ITask> {
    const logger = LoggerFactory.createLogger(`GetLogs, key: ${taskKey}`, 'TaskExecutor');

    return await new GetLogsTask(
      taskKey,
      logger,
      this.options.getLogs,
      payload,
      this.blockchainRepository
    ).init()
  }

  public async create(type: TaskTypes, taskKey: TaskKey, payload: any): Promise<ITask> {
    if (type === TaskTypes.GetLogs) {
      return this.createGetLogsTask(taskKey, payload);
    }
  }
}
