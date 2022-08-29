import pino from "pino";
import {ILogger} from "./logging.interfaces";
import configQuest from "../../quest/config/config.quest";

export class LoggerFactory {
  public static createLogger(serviceName: string, targetName: string): ILogger {
    return pino({
      level: configQuest.logLevel,
      transport: {
        target: 'pino-pretty',
        options: {
          ignore: 'serviceName,hostName',
          messageFormat: 'Service: "{serviceName}", Target: "{target}": {msg}',
          translateTime: "HH:MM:ss, dd-mm-yyyy",
        },
      },
    }).child({ serviceName: serviceName, target: targetName });
  }
}
