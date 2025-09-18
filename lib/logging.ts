/**
 * Basic logging system for testing
 */

export enum LogCategory {
  SYSTEM = 'SYSTEM',
  NETWORK = 'NETWORK',
  API_REQUEST = 'API_REQUEST',
  SECURITY = 'SECURITY',
  WALLET_OPERATION = 'WALLET_OPERATION'
}

export class Logger {
  private correlationId: string;

  constructor(correlationId: string = 'default') {
    this.correlationId = correlationId;
  }

  static createWithCorrelationId(correlationId: string = 'default'): Logger {
    return new Logger(correlationId);
  }

  static getInstance(): Logger {
    return new Logger();
  }

  getCorrelationId(): string {
    return this.correlationId;
  }

  info(message: string, data?: any, category: LogCategory = LogCategory.SYSTEM): void {
    console.info(`[INFO] [${category}] [${this.correlationId}] ${message}`, data);
  }

  warn(message: string, data?: any, category: LogCategory = LogCategory.SYSTEM): void {
    console.warn(`[WARN] [${category}] [${this.correlationId}] ${message}`, data);
  }

  error(message: string, error?: Error, data?: any, category: LogCategory = LogCategory.SYSTEM): void {
    console.error(`[ERROR] [${category}] [${this.correlationId}] ${message}`, error, data);
  }

  debug(message: string, data?: any, category: LogCategory = LogCategory.SYSTEM): void {
    console.debug(`[DEBUG] [${category}] [${this.correlationId}] ${message}`, data);
  }

  critical(message: string, error?: Error, data?: any, category: LogCategory = LogCategory.SYSTEM): void {
    console.error(`[CRITICAL] [${category}] [${this.correlationId}] ${message}`, error, data);
  }
}