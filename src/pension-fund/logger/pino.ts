import pino from 'pino';
import configPensionFund from "../config/config.pensionFund";

export const Logger = pino({
  level: configPensionFund.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      ignore: 'workerName,hostName',
      messageFormat: 'Worker: "{workerName}", Target: "{target}": {msg}',
      translateTime: "HH:MM:ss, dd-mm-yyyy",
    },
  },
}).child({ workerName: 'Pension Fund', target: 'Common' });
