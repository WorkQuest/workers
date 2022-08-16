import {Log} from "@ethersproject/abstract-provider/src.ts/index";

export interface ILogsFetcherWorker {
  on(type: 'logs', callback: (logs: Log[]) => void);

  startFetcher(): void;
}
