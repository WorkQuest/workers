import {Transaction} from "web3-eth";

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
export interface SyncRequestBlockHeight {
  fromBlock: number;
  toBlock: number;
}

export enum SyncRouterMessageType {
  Request = 'request',
  Response = 'response'
}

export enum SyncRouterRequestType {
  BlockHeight = 'block-height'
}

export enum SyncRouterResponseType {
  Transactions = 'transactions'
}

export interface SyncRouterMessage<Data> {
  type: SyncRouterMessageType;
  initiator: string;
  recipient: string;
  payload: {
    data: Data,
    type: SyncRouterResponseType | SyncRouterRequestType,
  };
}

export type SyncRouterRequest =
  | SyncRequestBlockHeight

export type SyncRouterResponse =
  | Transaction[]


export interface IRouterClient {
  on(type: 'close', callback: () => void);
  on(type: 'error', callback: (error) => void);
  on(type: 'transactions', callback: (transactions: Transaction[]) => void);
  on(type: 'sync-response', callback: (response: SyncRouterMessage<Transaction[]>) => void);

  sendSyncRequest(
    type: SyncRouterRequestType,
    requestPayload: SyncRouterRequest,
  ): Promise<void>;

  setFiltering(filter: (tx: Transaction) => boolean);
}

export interface IRouterServer {
  on(type: 'close', callback: () => void);
  on(type: 'error', callback: (error) => void);
  on(type: 'sync-request', callback: (request: SyncRouterMessage<SyncRequestBlockHeight>) => void);

  sendSyncResponse(
    type: SyncRouterResponseType,
    recipientQueue: string,
    responsePayload: SyncRouterResponse,
  ): Promise<void>;

  notifyAboutTransactions(...transactions: Transaction[]): Promise<void>;
}




export interface ITransactionListener {
  on(type: 'close', callback: () => void);
  on(type: 'error', callback: (error) => void);
  on(type: 'transactions', callback: (transactions: Transaction[]) => void);

  setFiltering(filter: (tx: Transaction) => boolean);
}

export interface IRouterWorkers {
  on(type: 'close', callback: () => void);
  on(type: 'error', callback: (error) => void);

  notifyAboutTransactions(...transactions: Transaction[]): Promise<void>;
}

export interface ISyncRouterWorkers {
  on(type: 'close', callback: () => void);
  on(type: 'error', callback: (error) => void);
  on(type: 'sync-request', callback: (request: SyncRouterMessage<SyncRequestBlockHeight>) => void);
  on(type: 'sync-response', callback: (response: SyncRouterMessage<Transaction[]>) => void);

  sendSyncRequest(
    requestPayload: SyncRouterRequest,
    type: SyncRouterRequestType,
  ): Promise<void>;

  sendSyncResponse(
    responsePayload: SyncRouterResponse,
    recipientQueue: string,
    type: SyncRouterResponseType,
  ): Promise<void>;
}
