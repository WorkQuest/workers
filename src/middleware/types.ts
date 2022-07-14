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
  on(type: 'worker-message', callback: (type: string, payload: object) => void);

  sendMessage(type: string, payload: object): Promise<void>;
}

export interface IRouterWorkers {
  on(type: 'close', callback: () => void);
  on(type: 'error', callback: (error) => void);

  notifyAboutTransactions(...transactions: Transaction[]): Promise<void>;
}
