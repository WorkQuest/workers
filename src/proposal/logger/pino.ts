import pino from 'pino';
import configProposal from "../config/config.proposal";

export const Logger = pino({
  level: configProposal.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      ignore: 'workerName,hostName',
      messageFormat: 'Worker: "{workerName}", Target: "{target}": {msg}',
      translateTime: "dd-mm-yyyy HH:MM:ss",
    },
  },
}).child({ workerName: 'Proposal', target: 'Common' });
