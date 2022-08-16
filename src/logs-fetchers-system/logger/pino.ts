import pino from 'pino';
import configFetchers from "../config/config.fetcher";

export const Logger = pino({
  level: configFetchers.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      ignore: 'workerName,hostName',
      messageFormat: 'Worker: "{workerName}", Target: "{target}": {msg}',
      translateTime: "HH:MM:ss, dd-mm-yyyy",
    },
  },
}).child({ workerName: 'Fetcher', target: 'Common' });
