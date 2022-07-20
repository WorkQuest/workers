import pino from 'pino';
import configSwapUsdt from "../config/config.swapUsdt";

export const Logger = pino({
  level: configSwapUsdt.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      ignore: 'workerName,hostName',
      messageFormat: '{workerName}: {msg}',
      translateTime: "HH:MM:ss dd-mm-yyyy",
    },
  },
}).child({ workerName: 'SwapUsdt' });
