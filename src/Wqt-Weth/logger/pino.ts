import pino from 'pino';
import configWqtWeth from "../config/config.WqtWeth";

export const Logger = pino({
  level: configWqtWeth.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      ignore: 'workerName,hostName',
      messageFormat: 'Worker: "{workerName}", Target: "{target}": {msg}',
      translateTime: "HH:MM:ss, dd-mm-yyyy",
    },
  },
}).child({ workerName: 'Wqt Weth', target: 'Common' });
