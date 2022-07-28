import Web3 from "web3";
import {BlocksRange} from "../../../types";
import {ITaskGetLogs} from "./task-queue.interfaces"
import {
  GetLogsOptions,
  TaskGetLogsResult,
  GetLogsTaskPayload,
  TaskCompletionStatus,
} from "./task-queue.types";

type State = {
  executionSteps: {
    toBlock: number,
    fromBlock: number,
  }
  blocksRange: BlocksRange,
  status: TaskCompletionStatus,
}

class GetLogsTask implements ITaskGetLogs {
  private readonly state: State;
  private result: TaskGetLogsResult;

  constructor(
    public readonly author: string,
    public readonly taskKey: string,
    protected readonly web3: Web3,
    protected readonly options: GetLogsOptions,
    protected readonly payload: GetLogsTaskPayload,
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
    ? await this.web3.eth.getBlockNumber()
    : this.payload.blocksRange.to

    this.state.executionSteps.fromBlock = this.payload.blocksRange.from;

    this.state.executionSteps.toBlock =
      (this.state.blocksRange.from + this.options.stepsRange) >= this.payload.blocksRange.to
        ? this.state.blocksRange.to
        : this.state.blocksRange.from + this.options.stepsRange
  }

  private incrementStepsState(): void {
    this.state.executionSteps.fromBlock = this.state.executionSteps.toBlock;
    this.state.executionSteps.toBlock += this.options.stepsRange;
  }

  private updateStatus(): TaskCompletionStatus {
    this.state.status =
      this.state.executionSteps.toBlock >= this.payload.blocksRange.to
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

    const logs = await this.web3.eth.getPastLogs({
      fromBlock: this.state.executionSteps.fromBlock,
      toBlock: this.state.executionSteps.toBlock,
    });

    this.result.logs.push(...logs as any[]);
    this.result.maxBlockHeightViewed = this.state.executionSteps.toBlock;

    if (this.updateStatus() === TaskCompletionStatus.Completed) {
      return TaskCompletionStatus.Completed;
    }

    this.incrementStepsState();
  }
}
