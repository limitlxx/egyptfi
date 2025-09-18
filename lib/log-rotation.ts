/**
 * Log rotation and retention policy implementation
 * Manages log cleanup and archival based on configurable policies
 */

import pool from './db';
import { Logger, LogLevel, LogCategory } from './logging';

export interface LogRetentionPolicy {
  systemLogs: {
    retentionDays: number;
    archiveBeforeDelete: boolean;
  };
  securityEvents: {
    retentionDays: number;
    archiveBeforeDelete: boolean;
  };
  walletOperations: {
    retentionDays: number;
    archiveBeforeDelete: boolean;
  };
}

export const DEFAULT_RETENTION_POLICY: LogRetentionPolicy = {
  systemLogs: {
    retentionDays: 90, // 3 months
    archiveBeforeDelete: false
  },
  securityEvents: {
    retentionDays: 365, // 1 year for compliance
    archiveBeforeDelete: true
  },
  walletOperations: {
    retentionDays: 730, // 2 years for financial records
    archiveBeforeDelete: true
  }
};

export class LogRotationManager {
  private logger: Logger;
  private policy: LogRetentionPolicy;

  constructor(policy: LogRetentionPolicy = DEFAULT_RETENTION_POLICY) {
    this.logger = Logger.createWithCorrelationId();
    this.policy = policy;
  }

  /**
   * Performs log rotation based on retention policy
   */
  public async rotateAllLogs(): Promise<void> {
    this.logger.info('Starting log rotation process', {}, LogCategory.SYSTEM);

    try {
      await this.rotateSystemLogs();
      await this.rotateSecurityEvents();
      await this.rotateWalletOperations();

      this.logger.info('Log rotation completed successfully', {}, LogCategory.SYSTEM);
    } catch (error) {
      this.logger.error('Log rotation failed', error as Error, {}, LogCategory.SYSTEM);
      throw error;
    }
  }

  /**
   * Rotates system logs
   */
  private async rotateSystemLogs(): Promise<void> {
    const { retentionDays, archiveBeforeDelete } = this.policy.systemLogs;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    this.logger.info(`Rotating system logs older than ${cutoffDate.toISOString()}`, {
      retentionDays,
      archiveBeforeDelete
    }, LogCategory.SYSTEM);

    const client = await pool.connect();
    try {
      // Count records to be affected
      const countResult = await client.query(
        'SELECT COUNT(*) FROM system_logs WHERE timestamp < $1',
        [cutoffDate]
      );
      const recordCount = parseInt(countResult.rows[0].count);

      if (recordCount === 0) {
        this.logger.info('No system logs to rotate', {}, LogCategory.SYSTEM);
        return;
      }

      if (archiveBeforeDelete) {
        await this.archiveSystemLogs(client, cutoffDate);
      }

      // Delete old records
      const deleteResult = await client.query(
        'DELETE FROM system_logs WHERE timestamp < $1',
        [cutoffDate]
      );

      this.logger.info(`Rotated ${deleteResult.rowCount} system log records`, {
        recordCount: deleteResult.rowCount,
        cutoffDate: cutoffDate.toISOString()
      }, LogCategory.SYSTEM);

    } finally {
      client.release();
    }
  }

  /**
   * Rotates security events
   */
  private async rotateSecurityEvents(): Promise<void> {
    const { retentionDays, archiveBeforeDelete } = this.policy.securityEvents;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    this.logger.info(`Rotating security events older than ${cutoffDate.toISOString()}`, {
      retentionDays,
      archiveBeforeDelete
    }, LogCategory.SYSTEM);

    const client = await pool.connect();
    try {
      // Count records to be affected
      const countResult = await client.query(
        'SELECT COUNT(*) FROM security_events WHERE timestamp < $1',
        [cutoffDate]
      );
      const recordCount = parseInt(countResult.rows[0].count);

      if (recordCount === 0) {
        this.logger.info('No security events to rotate', {}, LogCategory.SYSTEM);
        return;
      }

      if (archiveBeforeDelete) {
        await this.archiveSecurityEvents(client, cutoffDate);
      }

      // Delete old records
      const deleteResult = await client.query(
        'DELETE FROM security_events WHERE timestamp < $1',
        [cutoffDate]
      );

      this.logger.info(`Rotated ${deleteResult.rowCount} security event records`, {
        recordCount: deleteResult.rowCount,
        cutoffDate: cutoffDate.toISOString()
      }, LogCategory.SYSTEM);

    } finally {
      client.release();
    }
  }

  /**
   * Rotates wallet operations
   */
  private async rotateWalletOperations(): Promise<void> {
    const { retentionDays, archiveBeforeDelete } = this.policy.walletOperations;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    this.logger.info(`Rotating wallet operations older than ${cutoffDate.toISOString()}`, {
      retentionDays,
      archiveBeforeDelete
    }, LogCategory.SYSTEM);

    const client = await pool.connect();
    try {
      // Count records to be affected
      const countResult = await client.query(
        'SELECT COUNT(*) FROM wallet_operations_log WHERE created_at < $1',
        [cutoffDate]
      );
      const recordCount = parseInt(countResult.rows[0].count);

      if (recordCount === 0) {
        this.logger.info('No wallet operations to rotate', {}, LogCategory.SYSTEM);
        return;
      }

      if (archiveBeforeDelete) {
        await this.archiveWalletOperations(client, cutoffDate);
      }

      // Delete old records
      const deleteResult = await client.query(
        'DELETE FROM wallet_operations_log WHERE created_at < $1',
        [cutoffDate]
      );

      this.logger.info(`Rotated ${deleteResult.rowCount} wallet operation records`, {
        recordCount: deleteResult.rowCount,
        cutoffDate: cutoffDate.toISOString()
      }, LogCategory.SYSTEM);

    } finally {
      client.release();
    }
  }

  /**
   * Archives system logs to a separate table before deletion
   */
  private async archiveSystemLogs(client: any, cutoffDate: Date): Promise<void> {
    // Create archive table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_logs_archive (
        LIKE system_logs INCLUDING ALL
      )
    `);

    // Move records to archive
    await client.query(`
      INSERT INTO system_logs_archive 
      SELECT * FROM system_logs WHERE timestamp < $1
    `, [cutoffDate]);

    this.logger.info('System logs archived successfully', {
      cutoffDate: cutoffDate.toISOString()
    }, LogCategory.SYSTEM);
  }

  /**
   * Archives security events to a separate table before deletion
   */
  private async archiveSecurityEvents(client: any, cutoffDate: Date): Promise<void> {
    // Create archive table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS security_events_archive (
        LIKE security_events INCLUDING ALL
      )
    `);

    // Move records to archive
    await client.query(`
      INSERT INTO security_events_archive 
      SELECT * FROM security_events WHERE timestamp < $1
    `, [cutoffDate]);

    this.logger.info('Security events archived successfully', {
      cutoffDate: cutoffDate.toISOString()
    }, LogCategory.SYSTEM);
  }

  /**
   * Archives wallet operations to a separate table before deletion
   */
  private async archiveWalletOperations(client: any, cutoffDate: Date): Promise<void> {
    // Create archive table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS wallet_operations_log_archive (
        LIKE wallet_operations_log INCLUDING ALL
      )
    `);

    // Move records to archive
    await client.query(`
      INSERT INTO wallet_operations_log_archive 
      SELECT * FROM wallet_operations_log WHERE created_at < $1
    `, [cutoffDate]);

    this.logger.info('Wallet operations archived successfully', {
      cutoffDate: cutoffDate.toISOString()
    }, LogCategory.SYSTEM);
  }

  /**
   * Gets log statistics for monitoring
   */
  public async getLogStatistics(): Promise<{
    systemLogs: { total: number; oldestEntry: Date | null };
    securityEvents: { total: number; oldestEntry: Date | null };
    walletOperations: { total: number; oldestEntry: Date | null };
  }> {
    const client = await pool.connect();
    try {
      const [systemLogsResult, securityEventsResult, walletOpsResult] = await Promise.all([
        client.query('SELECT COUNT(*) as total, MIN(timestamp) as oldest FROM system_logs'),
        client.query('SELECT COUNT(*) as total, MIN(timestamp) as oldest FROM security_events'),
        client.query('SELECT COUNT(*) as total, MIN(created_at) as oldest FROM wallet_operations_log')
      ]);

      return {
        systemLogs: {
          total: parseInt(systemLogsResult.rows[0].total),
          oldestEntry: systemLogsResult.rows[0].oldest
        },
        securityEvents: {
          total: parseInt(securityEventsResult.rows[0].total),
          oldestEntry: securityEventsResult.rows[0].oldest
        },
        walletOperations: {
          total: parseInt(walletOpsResult.rows[0].total),
          oldestEntry: walletOpsResult.rows[0].oldest
        }
      };
    } finally {
      client.release();
    }
  }

  /**
   * Validates retention policy
   */
  public static validateRetentionPolicy(policy: LogRetentionPolicy): void {
    const tables = ['systemLogs', 'securityEvents', 'walletOperations'] as const;
    
    for (const table of tables) {
      const config = policy[table];
      if (config.retentionDays < 1) {
        throw new Error(`Retention days for ${table} must be at least 1`);
      }
      if (config.retentionDays > 3650) { // 10 years max
        throw new Error(`Retention days for ${table} cannot exceed 3650 days`);
      }
    }
  }
}

/**
 * Utility function to run log rotation (can be called from cron job)
 */
export async function runLogRotation(policy?: LogRetentionPolicy): Promise<void> {
  const manager = new LogRotationManager(policy);
  await manager.rotateAllLogs();
}

/**
 * Utility function to get log statistics
 */
export async function getLogStatistics(): Promise<any> {
  const manager = new LogRotationManager();
  return await manager.getLogStatistics();
}