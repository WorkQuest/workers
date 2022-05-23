import axios, { AxiosInstance } from 'axios';
import { TokenPriceProvider } from "./types";

export class OraclePricesProvider implements TokenPriceProvider {

  protected api: AxiosInstance;

  constructor(url: string) {
    this.api = axios.create({ baseURL: url });
  }

  public async coinPriceInUSD(timestamp: number | string): Promise<number> {
    try {
      const result = await this.api.get(`/v1/oracle/WQT/price?timestamp=${ timestamp }`, {
          timeout: 10000,
        },
      );

      return result.data.result;
    } catch (error) {
      return null
    }
  }
}
