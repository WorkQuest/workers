import pino from 'pino';
import configQuest from "../config/config.quest";

export const Logger = pino({
  level: configQuest.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      ignore: 'workerName,hostName',
      messageFormat: '{workerName}: {msg}',
      translateTime: "dd-mm-yyyy HH:MM:ss",
    },
  },
}).child({ workerName: 'Quest' });
