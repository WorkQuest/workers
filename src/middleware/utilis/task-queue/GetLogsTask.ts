import {ITaskGetLogs} from "./task-queue.interfaces"
import {ILogger} from "../../logging/logging.interfaces";
import {IBlockchainRepository} from "../../repository/repository.interfaces";
import {GetLogsOptions, GetLogsTaskPayload, TaskCompletionStatus, TaskGetLogsResult} from "./task-queue.types";

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
    protected readonly logger: ILogger,
    protected readonly options: GetLogsOptions,
    protected readonly payload: GetLogsTaskPayload,
    protected readonly blockchainRepository: IBlockchainRepository,
  ) {
  }

  public async init(): Promise<this> {
    await this.initState();
    this.initResult();

    return this;
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
      (this.state.blocksRange.from + this.options.stepsRange) >= this.state.blocksRange.to
        ? this.state.blocksRange.to
        : this.state.blocksRange.from + this.options.stepsRange
  }

  private incrementStepsState(): void {
    this.state.executionSteps.from = this.state.executionSteps.to + 1;

    this.state.blocksRange.to < this.state.executionSteps.to + this.options.stepsRange
      ? this.state.executionSteps.to = this.state.blocksRange.to
      : this.state.executionSteps.to += this.options.stepsRange
  }

  private errorHandling(error) {
    this.state.status = TaskCompletionStatus.Error;
    this.result = { logs: [], maxBlockHeightViewed: this.state.blocksRange.from }

    this.logger.error(error, 'The worker ended with an error');
  }

  private updateStatus(): TaskCompletionStatus {
    if (this.state.status === TaskCompletionStatus.Error) {
      return TaskCompletionStatus.Error;
    }

    this.state.status =
      this.state.executionSteps.to >= this.state.blocksRange.to
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
    try {
      this.logger.info('Start execution of a task');

      if (this.getStatus() !== TaskCompletionStatus.InProgress) {
        this.logger.info(
          'The worker has already completed the task. '
          + 'Returning the status "%s"',
          this.getStatus(),
        );

        return this.getStatus();
      }

      this.logger.debug(
        'Get logs with execution steps. From: "%s", To: "%s"',
        this.state.executionSteps.from,
        this.state.executionSteps.to,
      );

      const logs = await this.blockchainRepository.getPastLogs({
        addresses: [this.payload.addresses].flat(),
        fromBlockNumber: this.state.executionSteps.from,
        toBlockNumber: this.state.executionSteps.to,
      });

      this.logger.debug(
        'Number of collected logs: "%s". Logs: %o',
        logs.length,
        logs,
      );

      this.result.logs.push(...logs as any[]);
      this.result.maxBlockHeightViewed = this.state.executionSteps.to;

      this.logger.debug('Number of collected logs: "%s"', this.result.logs);

      if (this.updateStatus() === TaskCompletionStatus.Completed) {
        this.logger.info('The worker has finished executing');

        return TaskCompletionStatus.Completed;
      }

      this.incrementStepsState();

      return TaskCompletionStatus.InProgress;
    } catch (error) {
      this.errorHandling(error);

      return TaskCompletionStatus.Error;
    }
  }
}
