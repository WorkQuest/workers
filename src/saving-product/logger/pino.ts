import pino from 'pino';
import configSavings from "../config/config.savings";

export const Logger = pino({
  level: configSavings.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      ignore: 'workerName,hostName',
      messageFormat: '{workerName}: {msg}',
      translateTime: "HH:MM:ss dd-mm-yyyy",
    },
  },
}).child({ workerName: 'Saving Product' });
