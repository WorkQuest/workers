import {Transaction} from "web3-eth";
import {BlocksRange} from "../../types";
import {TaskPriority, TaskKey} from "../utilis/utilits.types"
import {Log} from "@ethersproject/abstract-provider/src.ts/index";
import {BlockchainNetworks} from "@workquest/database-models/lib/models";
import {
  NotifyPayload,
  TaskRouterRequest,
  TaskRouterResponse,
  SubscriptionRouterResponse,
} from "./message-queue.types";

/**
 *        Bridge between workers
 * Communication between workers (workerName, name of the running worker)
 *   and their different networks (network, see enum BlockchainNetworks).
 * Each worker may not be unique and run on multiple networks.
 * Each action can be divided by type.
 *
 */
export interface IBridgeBetweenWorkers {
  readonly workerName: string;
  readonly network: BlockchainNetworks;

  on(type: 'close', callback: () => void);
  on(type: 'error', callback: (error) => void);
  on(type: 'worker-message', callback: (type: string, payload: object) => void);

  sendMessage(whose: { workerName: string, network: BlockchainNetworks }, type: string, payload: object): Promise<void>;
}

/**
 *  Notification client is designed to notify
 *    listeners about events and other useful data.
 *  See repo https://github.com/WorkQuest/notification-server
 */
export interface INotificationClient {
  on(type: 'close', callback: () => void);
  on(type: 'error', callback: (error) => void);

  notify(payload: NotifyPayload): Promise<void>;
}

/**
 * Routers for working with blockchain nodes:
 *    Represents a bottleneck for optimizing node requests.
 *    Optimization of queries per node in N time.
 *    The interfaces are divided into two sides - the one who
 *      executes requests and those who only send.
 *
 */
export interface IRouterClient {
  readonly clientName: string;

  on(type: 'close', callback: () => void);
  on(type: 'error', callback: (error) => void);
  on(type: 'task-response', callback: (taskResponse: TaskRouterResponse) => void);
  on(type: 'subscription-response', callback: (subscriptionResponse: SubscriptionRouterResponse) => void);

  sendTaskGetLogs(blocksRange: BlocksRange, addresses: string | string[], priority: TaskPriority): Promise<TaskKey>;
}

export interface IRouterServer {
  on(type: 'close', callback: () => void);
  on(type: 'error', callback: (error) => void);
  on(type: 'task-request', callback: (taskRequest: TaskRouterRequest) => void);

  notifyEveryoneAboutNewLogs(logs: Log[]): Promise<void>;
  sendExecutedTaskGetLogs(clientName: string, task: { key: string, logs: Log[], maxBlockHeightViewed: number }): Promise<void>;
}



// TODO delete
export interface ITransactionListener {
  on(type: 'close', callback: () => void);
  on(type: 'error', callback: (error) => void);
  on(type: 'transactions', callback: (transactions: Transaction[]) => void);

  setFiltering(filter: (tx: Transaction) => boolean);
}
