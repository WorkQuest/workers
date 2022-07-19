import pino from 'pino';
import configSwapUsdt from "../config/config.swapUsdt";

export const Logger = pino({
  level: configSwapUsdt.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      ignore: 'workerName,hostName',
      translateTime: "HH:MM:ss, dd-mm-yyyy",
      messageFormat: 'Worker: "{workerName}", Target: "{target}": {msg}',
    },
  },
}).child({ workerName: 'SwapUsdt', target: 'Common' });
