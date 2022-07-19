import pino from 'pino';
import configBridge from "../config/config.bridge";

export const Logger = pino({
  level: configBridge.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      ignore: 'workerName,hostName,target',
      translateTime: "dd-mm-yyyy HH:MM:ss",
      messageFormat: 'Worker: "{workerName}", Target: "{target}": {msg}',
    },
  },
}).child({ workerName: 'Bridge', target: 'Common' });
