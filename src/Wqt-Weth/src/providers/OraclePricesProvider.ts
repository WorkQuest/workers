import axios, {AxiosInstance} from 'axios';
import {Coin, TokenPriceProvider} from "./types";

export class OraclePricesProvider implements TokenPriceProvider {

  protected api: AxiosInstance;

  constructor(url: string) {
    this.api = axios.create({ baseURL: url });
  }

  public async coinPriceInUSD(timestamp: number | string, coin: Coin): Promise<number> {
    const result = await this.api.get(`/v1/oracle/${coin}/price?timestamp=${timestamp}`, {
        timeout: 10000,
      },
    );

    return result.data.result;
  }
}
