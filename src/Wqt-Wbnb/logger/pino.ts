import pino from 'pino';
import configWqtWbnb from "../config/config.WqtWbnb";

export const Logger = pino({
  level: configWqtWbnb.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      ignore: 'workerName,hostName',
      messageFormat: 'Worker: "{workerName}", Target: "{target}": {msg}',
      translateTime: "HH:MM:ss, dd-mm-yyyy",
    },
  },
}).child({ workerName: 'Wqt Wbnb', target: 'Common' });
