
export interface TokenPriceProvider {
  coinPriceInUSD(timestamp: number | string): Promise<number>;
}

export * from  '../../../types';
