import {Transaction} from "web3-eth";
import {Log} from "@ethersproject/abstract-provider/src.ts/index";
import {
  TaskKey,
  BlocksRange,
  TaskRequest,
  TaskResponse,
  SubscriptionResponse,
} from "./middleware.types";

/**
 * Bridge between workers is designed
 *  to interact with workers and send them
 *  useful data
 */
export interface IBridgeBetweenWorkers {
  on(type: 'close', callback: () => void);
  on(type: 'error', callback: (error) => void);
  on(type: 'worker-message', callback: (whose: string, type: string, payload: object) => void);

  sendMessage(whose: string, type: string, payload: object): Promise<void>;
}

/**
 * Key value repository is intended to store useful data
 *  for frequent access. For example, contracts that are
 *  created by means of factories
 */
export interface IKeyValueRepository<TPayload> {
  on(type: 'close', callback: () => void);
  on(type: 'error', callback: (error) => void);

  getKeys(): Promise<string[]>;
  remove(key: string): Promise<void>;
  get(key: string): Promise<TPayload | null>;
  set(key: string, payload: TPayload): Promise<void>;
}

/**
 *  Notification client is designed to notify
 *    listeners about events and other useful data.
 *  See repo https://github.com/WorkQuest/notification-server
 */
export interface NotifyPayload {
  data: object;
  action: string;
  recipients: string[];
}

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
  on(type: 'task-response', callback: (taskResponse: TaskResponse) => void);
  on(type: 'subscription-response', callback: (subscriptionResponse: SubscriptionResponse) => void);

  sendTaskGetLogs(blocksRange: BlocksRange, addresses: string | string[]): Promise<TaskKey>;
}

export interface IRouterServer {
  on(type: 'close', callback: () => void);
  on(type: 'error', callback: (error) => void);
  on(type: 'task-request', callback: (taskRequest: TaskRequest) => void);

  notifyEveryoneAboutNewLogs(logs: Log[]): Promise<void>;
  sendExecutedTaskGetLogs(clientName: string, logs: Log[]): Promise<void>;
}



// TODO delete
export interface ITransactionListener {
  on(type: 'close', callback: () => void);
  on(type: 'error', callback: (error) => void);
  on(type: 'transactions', callback: (transactions: Transaction[]) => void);

  setFiltering(filter: (tx: Transaction) => boolean);
}
