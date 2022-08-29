import {Log} from "@ethersproject/abstract-provider/src.ts/index";
import {
  TaskKey,
  TaskTypes,
  TaskPriority,
  TaskGetLogsResult,
  GetLogsTaskPayload,
} from "../utilis/utilits.types";

/**
 *      Notification client types.
 * See repo https://github.com/WorkQuest/notification-server
 */
export type NotifyPayload = {
  data: object;
  action: string;
  recipients: string[];
}

/**
 *      Subscription types for RouterClient/RouterServer
 * RouterServer subscription types by clients (workers).
 */
export enum SubscriptionRouterTypes {
  NewLogs = 'NewLogs',
  ServerStarted = 'ServerStarted'
}

/**
 *      Responses and Subscription types for RouterClient
 * Subscription - returns subscriptions from the RouterServer.
 * TaskResponse - returns the execution of the task by the RouterServer.
 */
export type TaskRouterResponse = {
  task: TaskTypes,
  key: TaskKey,
  data: any,
}

export type SubscriptionRouterResponse = {
  subscription: SubscriptionRouterTypes,
  data?: any,
}

export type TaskRouterGetLogsResponse = TaskRouterResponse & {
  task: TaskTypes.GetLogs,
  data: TaskGetLogsResult,
}

export type SubscriptionRouterNewLogsResponse = SubscriptionRouterResponse & {
  subscription: SubscriptionRouterTypes.NewLogs,
  data: { logs: Log[] },
}

export type SubscriptionRouterServerStartedResponse = SubscriptionRouterResponse & {
  subscription: SubscriptionRouterTypes.ServerStarted,
}

/**
 *      Requests types for RouterClient
 * TaskRequest - accepts tasks for execution from the RouterClient.
 */
export type TaskRouterRequest = {
  key: TaskKey,
  task: TaskTypes,
  payload: any,
  clientName: string,
  priority: TaskPriority,
}

export type TaskGetLogsRequest = TaskRouterRequest & {
  task: TaskTypes.GetLogs,
  payload: GetLogsTaskPayload,
}
