import axios, { AxiosInstance } from 'axios';
import { ITokenPriceProvider } from "./interfaces";

export class OraclePricesProvider implements ITokenPriceProvider {

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
