import pino from 'pino';
import configFetchers from "../config/config.fetcher";

export const Logger = pino({
  level: configFetchers.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      ignore: 'workerName,hostName',
      messageFormat: '{workerName}: {msg}',
      translateTime: "dd-mm-yyyy HH:MM:ss",
    },
  },
}).child({ workerName: 'Fetcher' });
