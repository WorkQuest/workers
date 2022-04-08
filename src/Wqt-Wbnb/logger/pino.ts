import pino from 'pino';
import configWqtWbnb from "../config/config.WqtWbnb";

export const Logger = pino({
  level: configWqtWbnb.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      ignore: 'workerName,hostName',
      messageFormat: '{workerName}: {msg}',
      translateTime: "dd-mm-yyyy HH:MM:ss",
    },
  },
}).child({ workerName: 'Wqt Wbnb' });
