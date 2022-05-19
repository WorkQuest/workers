import { TransactionBroker } from "../../../brokers/src/TransactionBroker";
import { Clients } from '../../../types';
import { NotificationBroker } from "../../../brokers/src/NotificationBroker";

export interface TokenPriceProvider {
  coinPriceInUSD(timestamp: number | string): Promise<number>;
}

export interface SwapUsdtClients extends Clients {
  readonly notificationsBroker: NotificationBroker;
}

export interface SwapUsdtWorkNetClients extends SwapUsdtClients {
  readonly transactionsBroker: TransactionBroker;
}

export interface SwapUsdtEthClients extends SwapUsdtClients {
  readonly webSocketProvider: any;
}

export * from  '../../../types';
