export interface ILogger {
  warn(log: string, ...payload: any[]);
  info(log: string, ...payload: any[]);
  debug(log: string, ...payload: any[]);
  error(error: any, log, ...payload: any[]);
}
