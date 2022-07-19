import pino from 'pino';
import configProposal from "../config/config.proposal";

export const Logger = pino({
  level: configProposal.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      ignore: 'workerName,hostName',
      messageFormat: 'Worker: "{workerName}", Target: "{target}": {msg}',
      translateTime: "HH:MM:ss, dd-mm-yyyy",
    },
  },
}).child({ workerName: 'Proposal', target: 'Common' });
