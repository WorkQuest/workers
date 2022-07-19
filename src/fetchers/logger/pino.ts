import pino from 'pino';
import configFetchers from "../config/config.fetcher";

export const Logger = pino({
  level: configFetchers.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      ignore: 'workerName,hostName',
      messageFormat: '{workerName}: {msg}',
      translateTime: "HH:MM:ss dd-mm-yyyy",
    },
  },
}).child({ workerName: 'Fetcher' });
