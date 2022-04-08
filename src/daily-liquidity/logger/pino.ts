import pino from 'pino';
import configLiquidity from "../config/config.liquidity";

export const Logger = pino({
  level: configLiquidity.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      ignore: 'workerName,hostName',
      messageFormat: '{workerName}: {msg}',
      translateTime: "dd-mm-yyyy HH:MM:ss",
    },
  },
}).child({ workerName: 'Daily Liquidity' });
