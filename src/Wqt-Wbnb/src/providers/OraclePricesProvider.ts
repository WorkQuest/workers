import axios, {AxiosInstance} from 'axios';
import {Coin, TokenPriceProvider} from "./types";

export class OraclePricesProvider implements TokenPriceProvider {

  protected api: AxiosInstance;

  constructor(url: string) {
    this.api = axios.create({ baseURL: url });
  }

  public async coinPriceInUSD(timestamp: number | string, coin: Coin): Promise<number> {
    const timestampInMilliseconds = parseInt(timestamp.toString()) * 1000;

    const result = await this.api.get(`/v1/oracle/${coin}/price?timestamp=${timestampInMilliseconds}`, {
      timeout: 10000,
      },
    );

    return result.data.result;
  }
}
