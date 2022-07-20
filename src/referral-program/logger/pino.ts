import pino from 'pino';
import configReferral from "../config/config.referral";

export const Logger = pino({
  level: configReferral.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      ignore: 'workerName,hostName',
      messageFormat: '{workerName}: {msg}',
      translateTime: "HH:MM:ss dd-mm-yyyy",
    },
  },
}).child({ workerName: 'Referral Program' });
