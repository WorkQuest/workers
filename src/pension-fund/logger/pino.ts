import pino from 'pino';
import configPensionFund from "../config/config.pensionFund";

export const Logger = pino({
  level: configPensionFund.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      ignore: 'workerName,hostName',
      messageFormat: '{workerName}: {msg}',
      translateTime: "dd-mm-yyyy HH:MM:ss",
    },
  },
}).child({ workerName: 'Pension Fund' });
