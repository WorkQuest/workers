import pino from 'pino';
import configQuest from "../config/config.quest";

export const Logger = pino({
  level: configQuest.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      ignore: 'workerName,hostName',
      messageFormat: 'Worker: "{workerName}", Target: "{target}": {msg}',
      translateTime: "HH:MM:ss, dd-mm-yyyy",
    },
  },
}).child({ workerName: 'Quest', target: 'Common' });
