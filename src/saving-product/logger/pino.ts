import pino from 'pino';
import configSavings from "../config/config.savings";

export const Logger = pino({
  level: configSavings.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      ignore: 'workerName,hostName',
      messageFormat: 'Worker: "{workerName}", Target: "{target}": {msg}',
      translateTime: "dd-mm-yyyy HH:MM:ss",
    },
  },
}).child({ workerName: 'Saving Product', target: 'Common' });
