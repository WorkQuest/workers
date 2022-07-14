import { Clients } from "../../../types";
import { NotificationBroker } from "../../../middleware/src/NotificationBroker";

export enum Coin {
  WQT = 'WQT',
  BNB = 'BNB',
}

export interface TokenPriceProvider {
  coinPriceInUSD(timestamp: number | string, coin: Coin): Promise<number>;
}

export interface WqtWbnbClients extends Clients {
  notificationsBroker: NotificationBroker;
}

export * from '../../../types';
