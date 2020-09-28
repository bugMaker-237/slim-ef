import {
  IDbContextOptionsBuilder,
  ILogger,
  ILoggerCategoryName,
  ILoggerFactory
} from './interfaces';

export class DbContextOptionsBuilder implements IDbContextOptionsBuilder {
  private _loggerFactory: ILoggerFactory;
  private _loggerMap = new Map();
  sensitiveDataLoggingEnabled: boolean;
  public useLoggerFactory(loggerFactory: ILoggerFactory): this {
    this._loggerFactory = loggerFactory;
    return this;
  }
  public enableSensitiveLogging(enabled = true): this {
    this.sensitiveDataLoggingEnabled = enabled;
    return this;
  }
  createLogger(catName: ILoggerCategoryName): ILogger {
    return (
      this._loggerMap.get(catName) ||
      (this._loggerMap.set(catName, this._loggerFactory?.createLogger(catName)),
      this._loggerMap.get(catName))
    );
  }
}
