import {GetLogsTask} from "./GetLogsTask";
import {ITask, ITaskFactory} from "./task-queue.interfaces";
import {BlockchainNetworks} from "@workquest/database-models/lib/models";
import {IBlockchainRepository} from "../../repository/repository.interfaces";
import {GetLogsOptions, GetLogsTaskPayload, TaskKey, TaskTypes,} from "./task-queue.types";

export class TasksFactory implements ITaskFactory {
  constructor(
    protected readonly network: BlockchainNetworks,
    protected readonly blockchainRepository: IBlockchainRepository,
  ) {
  }

  protected createGetLogsTask(taskKey: TaskKey, payload: GetLogsTaskPayload): ITask {
    // TODO in config
    const options: GetLogsOptions = {
      stepsRange: this.network === BlockchainNetworks.workQuestNetwork || this.network === BlockchainNetworks.workQuestDevNetwork
        ? 10000
        : 2000
    }

    return new GetLogsTask(
      taskKey,
      options,
      payload,
      this.blockchainRepository
    )
  }

  public create(type: TaskTypes, taskKey: TaskKey, payload: any): ITask {
    if (type === TaskTypes.GetLogs) {
      return this.createGetLogsTask(taskKey, payload);
    }
  }
}
