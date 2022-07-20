import pino from 'pino';
import configBridge from "../config/config.bridge";

export const Logger = pino({
  level: configBridge.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      ignore: 'workerName,hostName',
      messageFormat: '{workerName}: {msg}',
      translateTime: "HH:MM:ss dd-mm-yyyy",
    },
  },
}).child({ workerName: 'Bridge' });
