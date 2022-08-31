import {Log} from "@ethersproject/abstract-provider/src.ts/index";
import {
  TaskKey,
  TaskTypes,
  TaskPriority,
  TaskGetLogsResult,
  GetLogsTaskPayload, TaskExecutorOptions,
} from "../utilis/utilits.types";

/**
 *      RouterServer Services.
 *  A router may include many services.
 *  For the execution of tasks, server services can be
 *    executed both in one process (ServerRouterServices.AllServices) and
 *    scaled into several processes (ServerRouterServices.TaskExecutor, ServerRouterServices.SendingNewLogs)
 *
 * ServerRouterServices.TaskExecutor - must be unique and run in the same process.
 * ServerRouterServices.SendingNewLogs - is not a unique service and can be run in multiple processes.
 */
export enum ServerRouterServices {
  None = 0,

  TaskExecutor = 1 << 0,
  SendingNewLogs = 1 << 1,

  AllServices = ServerRouterServices.TaskExecutor | ServerRouterServices.SendingNewLogs,
}

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
  TaskExecutorServerStarted = 'TaskExecutorServerStarted'
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

export type SubscriptionTaskExecutorRouterServerStartedResponse = SubscriptionRouterResponse & {
  subscription: SubscriptionRouterTypes.TaskExecutorServerStarted,
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
