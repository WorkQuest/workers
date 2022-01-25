import axios from 'axios';
import { Coin, TokenPriceProvider } from './types';

enum CoinGeckoCoin {
  WQT = 'work-quest',
  BNB = 'binancecoin',
}

export class CoinGeckoProvider implements TokenPriceProvider {
  private readonly api;

  private checkStartTimeInMilliseconds: number;

  private readonly limitTimeInMilliseconds: number;

  private numberOfRequests: number;

  private readonly limitRequests: number;

  constructor() {
    this.api = axios.create({
      baseURL: 'https://api.coingecko.com/api/v3/',
    });
    this.limitTimeInMilliseconds = 1000;
    this.limitRequests = 10;
    this.checkStartTimeInMilliseconds = Date.now();
    this.numberOfRequests = 0;
  }

  private async checkLimit() {
    const timeDifference = Date.now() - this.checkStartTimeInMilliseconds;

    if (this.numberOfRequests >= this.limitRequests && timeDifference >= this.limitTimeInMilliseconds) {
      const timeToNextRequest = 10000; // 10 sec

      await new Promise((res) => setTimeout(res, timeToNextRequest));

      this.zeroingLimit();
    }
  }

  private zeroingLimit() {
    this.checkStartTimeInMilliseconds = Date.now();
    this.numberOfRequests = 0;
  }

  private updateLimitInfo() {
    this.numberOfRequests++;
  }

  public static getNameCoin(coin: Coin): string {
    if (coin === Coin.BNB) {
      return CoinGeckoCoin.BNB;
    }
    if (coin === Coin.WQT) {
      return CoinGeckoCoin.WQT;
    }
  }

  public async coinPriceInUSD(timestamp: number | string, coin: Coin): Promise<number | null> {
    await this.checkLimit();

    const coinName = CoinGeckoProvider.getNameCoin(coin);

    const result = await this.api.get(
      `coins/${coinName}/market_chart/range?vs_currency=usd&from=${parseInt(timestamp as string) - 1800 - 60}&to=${
        parseInt(timestamp as string) + 1800 + 60
      }`,
      {
        timeout: 10000,
      },
    );

    this.updateLimitInfo();

    if (result.data && result.data.prices) {
      if (result.data.prices.length === 0) {
        return null;
      }
      return result.data.prices[0][1];
    }

    return null;
  }
}
