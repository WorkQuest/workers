import { Clients } from "../../../types";
import { NotificationBroker } from "../../../brokers/src/NotificationBroker";

export enum Coin {
  WQT = 'WQT',
  ETH = 'ETH',
}

export interface TokenPriceProvider {
  coinPriceInUSD(timestamp: number | string, coin: Coin): Promise<number>;
}

export interface WqtWethClients extends Clients {
  notificationsBroker: NotificationBroker;
}

export * from '../../../types';
