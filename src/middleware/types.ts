import {Transaction} from "web3-eth";

export interface NotifyPayload {
  data: object;
  action: string;
  recipients: string[];
}

export interface ITransactionListener {
  on(type: 'close', callback: () => void);
  on(type: 'error', callback: (error) => void);
  on(type: 'transactions', callback: (transactions: Transaction[]) => void);

  setFiltering(filter: (tx: Transaction) => boolean);
}

export interface INotificationClient {
  on(type: 'close', callback: () => void);
  on(type: 'error', callback: (error) => void);

  notify(payload: NotifyPayload): Promise<void>;
}

export interface IBridgeBetweenWorkers {
  on(type: 'close', callback: () => void);
  on(type: 'error', callback: (error) => void);
  on(type: 'worker-message', callback: (whose: string, type: string, payload: object) => void);

  sendMessage(whose: string, type: string, payload: object): Promise<void>;
}

export interface IRouterWorkers {
  on(type: 'close', callback: () => void);
  on(type: 'error', callback: (error) => void);

  notifyAboutTransactions(...transactions: Transaction[]): Promise<void>;
}

export interface IKeyValueRepository<TPayload> {
  on(type: 'close', callback: () => void);
  on(type: 'error', callback: (error) => void);

  remove(key: string): Promise<void>;
  get(key: string): Promise<TPayload | null>;
  set(key: string, payload: TPayload): Promise<void>;
}
