export enum Coin {
  WQT = 'WQT',
  BNB = 'BNB',
}

export interface TokenPriceProvider {
  coinPriceInUSD(timestamp: number | string, coin: Coin): Promise<number>;
}

export * from '../../../types';
