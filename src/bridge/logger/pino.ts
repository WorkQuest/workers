import pino from 'pino';
import configBridge from "../config/config.bridge";

export const Logger = pino({
  level: configBridge.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      ignore: 'workerName,hostName,target',
      translateTime: "HH:MM:ss, dd-mm-yyyy",
      messageFormat: 'Worker: "{workerName}", Target: "{target}": {msg}',
    },
  },
}).child({ workerName: 'Bridge', target: 'Common' });
