export type TaskKey = string;

export enum TaskTypes {
  GetLogs = 'GetLogs',
}

export type TaskRequest = {
  readonly task: TaskTypes,
  readonly payload: object,
}

export type BlocksRange = {
  from: number, to: number | 'latest'
}

export type TaskResponse = {
  readonly task: TaskTypes,
  readonly key: TaskKey,
  readonly data: any,
}

export enum SubscriptionTypes {
  NewLogs = 'NewLogs',
}

export type SubscriptionResponse = {
  readonly subscription: SubscriptionTypes,
  readonly data: any,
}
