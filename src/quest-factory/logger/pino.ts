import pino from 'pino';
import configQuestFactory from "../config/config.questFactory";

export const Logger = pino({
  level: configQuestFactory.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      ignore: 'workerName,hostName',
      messageFormat: 'Worker: "{workerName}", Target: "{target}": {msg}',
      translateTime: "HH:MM:ss, dd-mm-yyyy",
    },
  },
}).child({ workerName: 'Quest-factory', target: 'Common' });
