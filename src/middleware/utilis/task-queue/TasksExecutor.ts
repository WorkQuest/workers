import EventEmitter from 'events';
import PriorityQueue from "ts-priority-queue";
import {ITask, ITaskExecutor} from "./task-queue.interfaces";
import {
  TaskPool,
  TaskPriority,
  TaskExecutorOptions,
  TaskCompletionStatus,
} from "./task-queue.types";

export class TasksExecutor implements ITaskExecutor {
  private readonly completedTasks: ITask[] = [];
  private readonly tasksInProgress: ITask[] = [];
  private readonly taskPools: PriorityQueue<TaskPool>;

  private readonly eventEmitter: EventEmitter;

  private readonly options: TaskExecutorOptions = {
    concurrency: 10,
    intervalInMs: 10000,
  }

  constructor(options?: TaskExecutorOptions) {
    if (options) {
      this.options = options;
    }

    this.eventEmitter = new EventEmitter();

    this.taskPools = new PriorityQueue<TaskPool>({
      comparator: (firs, second) => {
        return second.options.priority - firs.options.priority;
      },
    });
  }

  private async takeAndExecuteTasks() {
    while (
      this.taskPools.length !== 0 &&
      this.tasksInProgress.length !== this.options.concurrency
    ) {
      const { task } = this.taskPools.peek();

      this.tasksInProgress.push(task);
    }

    if (this.tasksInProgress.length === 0) {
      return;
    }

    await Promise.all(
      this.tasksInProgress.map(async (ts) => {
        return ts.execute();
      }),
    );
  }

  private clearQueueOfCompletedTasks() {
    const completedTasks = this.tasksInProgress.filter((value) =>
      value.getStatus() === TaskCompletionStatus.Error ||
      value.getStatus() === TaskCompletionStatus.Completed
    );
    const inProgressTasks = this.tasksInProgress.filter((value) =>
      value.getStatus() === TaskCompletionStatus.InProgress
    );

    this.tasksInProgress.splice(0, this.tasksInProgress.length);

    this.completedTasks.push(...completedTasks);
    this.tasksInProgress.push(...inProgressTasks);
  }

  private async emitCompletedTasks() {
    if (this.completedTasks.length === 0) {
      return;
    }

    this.eventEmitter.emit('completed-tasks',
      this.pickUpCompletedTasks()
    );
  }

  private pickUpCompletedTasks(): ITask[] {
    return this.completedTasks.splice(0, this.completedTasks.length);
  }

  public on(type, callBack): void {
    if (type === 'completed-tasks') {
      this.eventEmitter.addListener('completed-tasks', callBack);
    }
  }

  public addTask(task: ITask, options: { priority: TaskPriority }) {
    this.taskPools.queue({ task, options });
  }

  public startExecute() {
    setInterval(async () => {
      await this.takeAndExecuteTasks();
      this.clearQueueOfCompletedTasks();
      await this.emitCompletedTasks();
    }, this.options.intervalInMs);
  }
}
