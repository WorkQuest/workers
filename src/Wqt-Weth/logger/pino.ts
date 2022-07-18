import pino from 'pino';
import configWqtWeth from "../config/config.WqtWeth";

export const Logger = pino({
  level: configWqtWeth.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      ignore: 'workerName,hostName',
      messageFormat: 'Worker: "{workerName}", Target: "{target}": {msg}',
      translateTime: "dd-mm-yyyy HH:MM:ss",
    },
  },
}).child({ workerName: 'Wqt Weth', target: 'Common' });
