/**
<<<<<<< HEAD
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
=======
 * Comprehensive logging and audit trail system
 * Provides structured logging with correlation IDs and audit capabilities
 */

import { v4 as uuidv4 } from 'uuid';
import pool from './db';

// Log levels
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

// Log categories
export enum LogCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  WALLET_OPERATION = 'WALLET_OPERATION',
  API_REQUEST = 'API_REQUEST',
  DATABASE = 'DATABASE',
  CHIPIPAY = 'CHIPIPAY',
  SECURITY = 'SECURITY',
  SYSTEM = 'SYSTEM'
}

// Security event types
export enum SecurityEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  INVALID_API_KEY = 'INVALID_API_KEY',
  PIN_FAILURE = 'PIN_FAILURE',
  PIN_LOCKOUT = 'PIN_LOCKOUT',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS'
}

// Wallet operation types
export enum WalletOperationType {
  WALLET_CREATION = 'WALLET_CREATION',
  TRANSFER = 'TRANSFER',
  APPROVE = 'APPROVE',
  STAKE_VESU_USDC = 'STAKE_VESU_USDC',
  WITHDRAW_VESU_USDC = 'WITHDRAW_VESU_USDC',
  CONTRACT_CALL = 'CONTRACT_CALL'
}

// Base log entry interface
interface BaseLogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  correlationId: string;
  requestId?: string;
  merchantId?: string;
  environment?: 'testnet' | 'mainnet';
  metadata?: Record<string, any>;
}

// Security log entry
interface SecurityLogEntry extends BaseLogEntry {
  category: LogCategory.SECURITY;
  eventType: SecurityEventType;
  ipAddress?: string;
  userAgent?: string;
  apiKey?: string; // Masked for security
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

// Wallet operation log entry
interface WalletOperationLogEntry extends BaseLogEntry {
  category: LogCategory.WALLET_OPERATION;
  operationType: WalletOperationType;
  txHash?: string;
  contractAddress?: string;
  amount?: string;
  recipient?: string;
  status: 'pending' | 'completed' | 'failed';
  errorMessage?: string;
}

// API request log entry
interface ApiRequestLogEntry extends BaseLogEntry {
  category: LogCategory.API_REQUEST;
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  ipAddress?: string;
  userAgent?: string;
}

// Logger class
export class Logger {
  private static instance: Logger;
  private correlationId: string;

  private constructor() {
    this.correlationId = uuidv4();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public static createWithCorrelationId(correlationId?: string): Logger {
    const logger = new Logger();
    logger.correlationId = correlationId || uuidv4();
    return logger;
  }

  public getCorrelationId(): string {
    return this.correlationId;
  }

  public setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
  }

  // Generic logging method
  private log(entry: BaseLogEntry): void {
    const logEntry = {
      ...entry,
      correlationId: this.correlationId,
      timestamp: new Date().toISOString()
    };

    // Console logging with structured format
    const logMessage = this.formatLogMessage(logEntry);
    
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(logMessage);
        break;
      case LogLevel.INFO:
        console.info(logMessage);
        break;
      case LogLevel.WARN:
        console.warn(logMessage);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(logMessage);
        break;
    }

    // Store in database for audit trail (async, don't block)
    this.storeLogEntry(logEntry).catch(error => {
      console.error('Failed to store log entry:', error);
    });
  }

  private formatLogMessage(entry: BaseLogEntry): string {
    const baseInfo = `[${entry.timestamp}] [${entry.level}] [${entry.category}] [${entry.correlationId}]`;
    const message = entry.message;
    const metadata = entry.metadata ? ` | ${JSON.stringify(entry.metadata)}` : '';
    
    return `${baseInfo} ${message}${metadata}`;
  }

  private async storeLogEntry(entry: BaseLogEntry): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO system_logs 
         (timestamp, level, category, message, correlation_id, request_id, merchant_id, environment, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          entry.timestamp,
          entry.level,
          entry.category,
          entry.message,
          entry.correlationId,
          entry.requestId,
          entry.merchantId,
          entry.environment,
          entry.metadata ? JSON.stringify(entry.metadata) : null
        ]
      );
    } finally {
      client.release();
    }
  }

  // Convenience methods for different log levels
  public debug(message: string, metadata?: Record<string, any>, category: LogCategory = LogCategory.SYSTEM): void {
    this.log({
      level: LogLevel.DEBUG,
      category,
      message,
      metadata,
      timestamp: '',
      correlationId: this.correlationId
    });
  }

  public info(message: string, metadata?: Record<string, any>, category: LogCategory = LogCategory.SYSTEM): void {
    this.log({
      level: LogLevel.INFO,
      category,
      message,
      metadata,
      timestamp: '',
      correlationId: this.correlationId
    });
  }

  public warn(message: string, metadata?: Record<string, any>, category: LogCategory = LogCategory.SYSTEM): void {
    this.log({
      level: LogLevel.WARN,
      category,
      message,
      metadata,
      timestamp: '',
      correlationId: this.correlationId
    });
  }

  public error(message: string, error?: Error, metadata?: Record<string, any>, category: LogCategory = LogCategory.SYSTEM): void {
    const errorMetadata = {
      ...metadata,
      ...(error && {
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack
      })
    };

    this.log({
      level: LogLevel.ERROR,
      category,
      message,
      metadata: errorMetadata,
      timestamp: '',
      correlationId: this.correlationId
    });
  }

  public critical(message: string, error?: Error, metadata?: Record<string, any>, category: LogCategory = LogCategory.SYSTEM): void {
    const errorMetadata = {
      ...metadata,
      ...(error && {
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack
      })
    };

    this.log({
      level: LogLevel.CRITICAL,
      category,
      message,
      metadata: errorMetadata,
      timestamp: '',
      correlationId: this.correlationId
    });
  }

  // Security event logging
  public logSecurityEvent(
    eventType: SecurityEventType,
    message: string,
    options: {
      merchantId?: string;
      ipAddress?: string;
      userAgent?: string;
      apiKey?: string;
      severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      metadata?: Record<string, any>;
    } = {}
  ): void {
    const { merchantId, ipAddress, userAgent, apiKey, severity = 'MEDIUM', metadata } = options;

    const securityEntry: SecurityLogEntry = {
      level: severity === 'CRITICAL' ? LogLevel.CRITICAL : LogLevel.WARN,
      category: LogCategory.SECURITY,
      eventType,
      message,
      merchantId,
      ipAddress,
      userAgent,
      apiKey: apiKey ? this.maskApiKey(apiKey) : undefined,
      severity,
      metadata,
      timestamp: '',
      correlationId: this.correlationId
    };

    this.log(securityEntry);

    // Store security event in dedicated table
    this.storeSecurityEvent(securityEntry).catch(error => {
      console.error('Failed to store security event:', error);
    });
  }

  // Wallet operation logging
  public logWalletOperation(
    operationType: WalletOperationType,
    status: 'pending' | 'completed' | 'failed',
    options: {
      merchantId?: string;
      txHash?: string;
      contractAddress?: string;
      amount?: string;
      recipient?: string;
      errorMessage?: string;
      environment?: 'testnet' | 'mainnet';
      metadata?: Record<string, any>;
    } = {}
  ): void {
    const {
      merchantId,
      txHash,
      contractAddress,
      amount,
      recipient,
      errorMessage,
      environment,
      metadata
    } = options;

    const message = `Wallet operation ${operationType} ${status}${txHash ? ` (tx: ${txHash})` : ''}`;

    const walletEntry: WalletOperationLogEntry = {
      level: status === 'failed' ? LogLevel.ERROR : LogLevel.INFO,
      category: LogCategory.WALLET_OPERATION,
      operationType,
      message,
      merchantId,
      environment,
      txHash,
      contractAddress,
      amount,
      recipient,
      status,
      errorMessage,
      metadata,
      timestamp: '',
      correlationId: this.correlationId
    };

    this.log(walletEntry);

    // Store in wallet operations log table
    this.storeWalletOperation(walletEntry).catch(error => {
      console.error('Failed to store wallet operation:', error);
    });
  }

  // API request logging
  public logApiRequest(
    method: string,
    path: string,
    statusCode: number,
    responseTime: number,
    options: {
      merchantId?: string;
      ipAddress?: string;
      userAgent?: string;
      metadata?: Record<string, any>;
    } = {}
  ): void {
    const { merchantId, ipAddress, userAgent, metadata } = options;

    const message = `${method} ${path} - ${statusCode} (${responseTime}ms)`;

    const apiEntry: ApiRequestLogEntry = {
      level: statusCode >= 500 ? LogLevel.ERROR : statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO,
      category: LogCategory.API_REQUEST,
      method,
      path,
      statusCode,
      responseTime,
      message,
      merchantId,
      ipAddress,
      userAgent,
      metadata,
      timestamp: '',
      correlationId: this.correlationId
    };

    this.log(apiEntry);
  }

  // Helper methods
  private maskApiKey(apiKey: string): string {
    if (apiKey.length <= 8) {
      return '*'.repeat(apiKey.length);
    }
    return apiKey.substring(0, 4) + '*'.repeat(apiKey.length - 8) + apiKey.substring(apiKey.length - 4);
  }

  private async storeSecurityEvent(entry: SecurityLogEntry): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO security_events 
         (timestamp, event_type, message, merchant_id, ip_address, user_agent, api_key_masked, severity, correlation_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          entry.timestamp,
          entry.eventType,
          entry.message,
          entry.merchantId,
          entry.ipAddress,
          entry.userAgent,
          entry.apiKey,
          entry.severity,
          entry.correlationId,
          entry.metadata ? JSON.stringify(entry.metadata) : null
        ]
      );
    } finally {
      client.release();
    }
  }

  private async storeWalletOperation(entry: WalletOperationLogEntry): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO wallet_operations_log 
         (merchant_id, operation_type, contract_address, amount, recipient, tx_hash, status, error_message, metadata, created_at, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT DO NOTHING`,
        [
          entry.merchantId,
          entry.operationType,
          entry.contractAddress,
          entry.amount ? parseFloat(entry.amount) : null,
          entry.recipient,
          entry.txHash,
          entry.status,
          entry.errorMessage,
          entry.metadata ? JSON.stringify(entry.metadata) : null,
          entry.timestamp,
          entry.status === 'completed' ? entry.timestamp : null
        ]
      );
    } catch (error) {
      // Ignore conflicts - wallet operations might be logged multiple times
      if (!error.message?.includes('duplicate key')) {
        throw error;
      }
    } finally {
      client.release();
    }
  }
}

// Audit trail utilities
export class AuditTrail {
  public static async getWalletOperations(
    merchantId: string,
    options: {
      operationType?: WalletOperationType;
      status?: 'pending' | 'completed' | 'failed';
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<any[]> {
    const { operationType, status, startDate, endDate, limit = 100, offset = 0 } = options;

    const client = await pool.connect();
    try {
      let query = `
        SELECT * FROM wallet_operations_log 
        WHERE merchant_id = $1
      `;
      const params: any[] = [merchantId];
      let paramIndex = 2;

      if (operationType) {
        query += ` AND operation_type = $${paramIndex}`;
        params.push(operationType);
        paramIndex++;
      }

      if (status) {
        query += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (startDate) {
        query += ` AND created_at >= $${paramIndex}`;
        params.push(startDate.toISOString());
        paramIndex++;
      }

      if (endDate) {
        query += ` AND created_at <= $${paramIndex}`;
        params.push(endDate.toISOString());
        paramIndex++;
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  public static async getSecurityEvents(
    options: {
      merchantId?: string;
      eventType?: SecurityEventType;
      severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<any[]> {
    const { merchantId, eventType, severity, startDate, endDate, limit = 100, offset = 0 } = options;

    const client = await pool.connect();
    try {
      let query = `SELECT * FROM security_events WHERE 1=1`;
      const params: any[] = [];
      let paramIndex = 1;

      if (merchantId) {
        query += ` AND merchant_id = $${paramIndex}`;
        params.push(merchantId);
        paramIndex++;
      }

      if (eventType) {
        query += ` AND event_type = $${paramIndex}`;
        params.push(eventType);
        paramIndex++;
      }

      if (severity) {
        query += ` AND severity = $${paramIndex}`;
        params.push(severity);
        paramIndex++;
      }

      if (startDate) {
        query += ` AND timestamp >= $${paramIndex}`;
        params.push(startDate.toISOString());
        paramIndex++;
      }

      if (endDate) {
        query += ` AND timestamp <= $${paramIndex}`;
        params.push(endDate.toISOString());
        paramIndex++;
      }

      query += ` ORDER BY timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  }
}

// Export singleton instance
export const logger = Logger.getInstance();
>>>>>>> backend
