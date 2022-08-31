
export interface ITokenPriceProvider {
  coinPriceInUSD(timestamp: number | string): Promise<number>;
}
