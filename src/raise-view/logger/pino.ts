import pino from 'pino';
import configRaiseView from "../config/config.raiseView";

export const Logger = pino({
  level: configRaiseView.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      ignore: 'workerName,hostName',
      messageFormat: 'Worker: "{workerName}", Target: "{target}": {msg}',
      translateTime: "HH:MM:ss, dd-mm-yyyy",
    },
  },
}).child({ workerName: 'Raise-view', target: 'Common' });
