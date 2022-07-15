
export enum Coin {
  WQT = 'WQT',
  ETH = 'ETH',
}

export interface TokenPriceProvider {
  coinPriceInUSD(timestamp: number | string, coin: Coin): Promise<number>;
}

export * from '../../../types';
