import {ITaskGetLogs} from "./task-queue.interfaces"
import {IBlockchainRepository} from "../../repository/repository.interfaces";
import {
  GetLogsOptions,
  TaskGetLogsResult,
  GetLogsTaskPayload,
  TaskCompletionStatus,
} from "./task-queue.types";

type State = {
  executionSteps: {
    to: number,
    from: number,
  }
  blocksRange: {
    to: number,
    from: number,
  },
  status: TaskCompletionStatus,
}

export class GetLogsTask implements ITaskGetLogs {
  private result: TaskGetLogsResult;

  private readonly state: State = {
    status: null,
    blocksRange: { from: null, to: null},
    executionSteps: { to: null, from: null },
  }

  constructor(
    public readonly taskKey: string,
    protected readonly options: GetLogsOptions,
    protected readonly payload: GetLogsTaskPayload,
    protected readonly blockchainRepository: IBlockchainRepository,
  ) {
  }

  public async init() {
    await this.initState();
    this.initResult();
  }

  private initResult(): void {
    this.result = {
      logs: [],
      maxBlockHeightViewed: this.payload.blocksRange.from,
    }
  }

  private async initState(): Promise<void> {
    this.state.status = TaskCompletionStatus.InProgress;
    this.state.blocksRange.from = this.payload.blocksRange.from;

    this.state.blocksRange.to =
      this.payload.blocksRange.to === 'latest'
    ? await this.blockchainRepository.getBlockNumber()
    : this.payload.blocksRange.to

    this.state.executionSteps.from = this.payload.blocksRange.from;

    this.state.executionSteps.to =
      (this.state.blocksRange.from + this.options.stepsRange) >= this.payload.blocksRange.to
        ? this.state.blocksRange.to
        : this.state.blocksRange.from + this.options.stepsRange
  }

  private incrementStepsState(): void {
    this.state.executionSteps.from = this.state.executionSteps.to + 1;

    this.state.blocksRange.to < this.state.executionSteps.to + this.options.stepsRange
      ? this.state.executionSteps.to = this.state.blocksRange.to
      : this.state.executionSteps.to += this.options.stepsRange
  }

  private updateStatus(): TaskCompletionStatus {
    this.state.status =
      this.state.executionSteps.to >= this.payload.blocksRange.to
        ? TaskCompletionStatus.Completed
        : TaskCompletionStatus.InProgress

    return this.state.status;
  }

  public getStatus() {
    return this.state.status;
  }

  public getExecutionResult() {
    return this.result;
  }

  public async execute() {
    if (this.getStatus() !== TaskCompletionStatus.InProgress) {
      return this.getStatus();
    }

    const logs = await this.blockchainRepository.getPastLogs({
      addresses: [this.payload.addresses].flat(),
      fromBlockNumber: this.state.executionSteps.from,
      toBlockNumber: this.state.executionSteps.to,
    });

    this.result.logs.push(...logs as any[]);
    this.result.maxBlockHeightViewed = this.state.executionSteps.to;

    if (this.updateStatus() === TaskCompletionStatus.Completed) {
      return TaskCompletionStatus.Completed;
    }

    this.incrementStepsState();

    return TaskCompletionStatus.InProgress;
  }
}
