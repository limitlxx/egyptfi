/**
 * Unit tests for log rotation system
 */

// Mock database pool
jest.mock('../../lib/db', () => ({
  __esModule: true,
  default: {
    connect: jest.fn()
  }
}));

import { LogRotationManager, DEFAULT_RETENTION_POLICY, runLogRotation, getLogStatistics } from '../../lib/log-rotation';

// Mock Logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn()
};

jest.mock('../../lib/logging', () => ({
  Logger: {
    createWithCorrelationId: jest.fn(() => mockLogger)
  },
  LogLevel: { INFO: 'INFO', ERROR: 'ERROR' },
  LogCategory: { SYSTEM: 'SYSTEM' }
}));

// Mock client and pool after imports
const mockClient = {
  query: jest.fn(),
  release: jest.fn()
};

const mockPool = require('../../lib/db').default;

describe('Log Rotation System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.connect.mockResolvedValue(mockClient);
  });

  describe('LogRotationManager', () => {
    describe('Constructor and Validation', () => {
      it('should create manager with default policy', () => {
        const manager = new LogRotationManager();
        expect(manager).toBeInstanceOf(LogRotationManager);
      });

      it('should create manager with custom policy', () => {
        const customPolicy = {
          systemLogs: { retentionDays: 30, archiveBeforeDelete: false },
          securityEvents: { retentionDays: 180, archiveBeforeDelete: true },
          walletOperations: { retentionDays: 365, archiveBeforeDelete: true }
        };
        
        const manager = new LogRotationManager(customPolicy);
        expect(manager).toBeInstanceOf(LogRotationManager);
      });

      it('should validate retention policy', () => {
        const invalidPolicy = {
          systemLogs: { retentionDays: 0, archiveBeforeDelete: false },
          securityEvents: { retentionDays: 365, archiveBeforeDelete: true },
          walletOperations: { retentionDays: 730, archiveBeforeDelete: true }
        };

        expect(() => {
          LogRotationManager.validateRetentionPolicy(invalidPolicy);
        }).toThrow('Retention days for systemLogs must be at least 1');
      });

      it('should validate maximum retention days', () => {
        const invalidPolicy = {
          systemLogs: { retentionDays: 90, archiveBeforeDelete: false },
          securityEvents: { retentionDays: 4000, archiveBeforeDelete: true },
          walletOperations: { retentionDays: 730, archiveBeforeDelete: true }
        };

        expect(() => {
          LogRotationManager.validateRetentionPolicy(invalidPolicy);
        }).toThrow('Retention days for securityEvents cannot exceed 3650 days');
      });
    });

    describe('System Logs Rotation', () => {
      it('should rotate system logs without archiving', async () => {
        const policy = {
          systemLogs: { retentionDays: 30, archiveBeforeDelete: false },
          securityEvents: { retentionDays: 365, archiveBeforeDelete: true },
          walletOperations: { retentionDays: 730, archiveBeforeDelete: true }
        };

        mockClient.query
          .mockResolvedValueOnce({ rows: [{ count: '100' }] }) // system logs count query
          .mockResolvedValueOnce({ rowCount: 100 }) // system logs delete query
          .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // security events count query
          .mockResolvedValueOnce({ rows: [{ count: '0' }] }); // wallet operations count query

        const manager = new LogRotationManager(policy);
        await manager.rotateAllLogs();

        expect(mockClient.query).toHaveBeenCalledWith(
          'SELECT COUNT(*) FROM system_logs WHERE timestamp < $1',
          [expect.any(Date)]
        );

        expect(mockClient.query).toHaveBeenCalledWith(
          'DELETE FROM system_logs WHERE timestamp < $1',
          [expect.any(Date)]
        );

        expect(mockLogger.info).toHaveBeenCalledWith(
          'Rotated 100 system log records',
          expect.objectContaining({
            recordCount: 100,
            cutoffDate: expect.any(String)
          }),
          'SYSTEM'
        );
      });

      it('should skip rotation when no records to rotate', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // system logs count query
          .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // security events count query
          .mockResolvedValueOnce({ rows: [{ count: '0' }] }); // wallet operations count query

        const manager = new LogRotationManager();
        await manager.rotateAllLogs();

        expect(mockLogger.info).toHaveBeenCalledWith(
          'No system logs to rotate',
          {},
          'SYSTEM'
        );
      });

      it('should archive system logs before deletion', async () => {
        const policy = {
          systemLogs: { retentionDays: 30, archiveBeforeDelete: true },
          securityEvents: { retentionDays: 365, archiveBeforeDelete: false },
          walletOperations: { retentionDays: 730, archiveBeforeDelete: false }
        };

        mockClient.query
          .mockResolvedValueOnce({ rows: [{ count: '50' }] }) // system logs count query
          .mockResolvedValueOnce({}) // create archive table
          .mockResolvedValueOnce({}) // insert into archive
          .mockResolvedValueOnce({ rowCount: 50 }) // system logs delete query
          .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // security events count query
          .mockResolvedValueOnce({ rows: [{ count: '0' }] }); // wallet operations count query

        const manager = new LogRotationManager(policy);
        await manager.rotateAllLogs();

        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('CREATE TABLE IF NOT EXISTS system_logs_archive')
        );

        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO system_logs_archive'),
          [expect.any(Date)]
        );

        expect(mockLogger.info).toHaveBeenCalledWith(
          'System logs archived successfully',
          expect.objectContaining({
            cutoffDate: expect.any(String)
          }),
          'SYSTEM'
        );
      });
    });

    describe('Security Events Rotation', () => {
      it('should rotate security events with archiving', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // system logs count
          .mockResolvedValueOnce({ rows: [{ count: '25' }] }) // security events count
          .mockResolvedValueOnce({}) // create archive table
          .mockResolvedValueOnce({}) // insert into archive
          .mockResolvedValueOnce({ rowCount: 25 }) // delete query
          .mockResolvedValueOnce({ rows: [{ count: '0' }] }); // wallet operations count

        const manager = new LogRotationManager();
        await manager.rotateAllLogs();

        expect(mockClient.query).toHaveBeenCalledWith(
          'SELECT COUNT(*) FROM security_events WHERE timestamp < $1',
          [expect.any(Date)]
        );

        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('CREATE TABLE IF NOT EXISTS security_events_archive')
        );

        expect(mockLogger.info).toHaveBeenCalledWith(
          'Rotated 25 security event records',
          expect.objectContaining({
            recordCount: 25
          }),
          'SYSTEM'
        );
      });
    });

    describe('Wallet Operations Rotation', () => {
      it('should rotate wallet operations with archiving', async () => {
        mockClient.query
          .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // system logs count
          .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // security events count
          .mockResolvedValueOnce({ rows: [{ count: '75' }] }) // wallet operations count
          .mockResolvedValueOnce({}) // create archive table
          .mockResolvedValueOnce({}) // insert into archive
          .mockResolvedValueOnce({ rowCount: 75 }); // delete query

        const manager = new LogRotationManager();
        await manager.rotateAllLogs();

        expect(mockClient.query).toHaveBeenCalledWith(
          'SELECT COUNT(*) FROM wallet_operations_log WHERE created_at < $1',
          [expect.any(Date)]
        );

        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('CREATE TABLE IF NOT EXISTS wallet_operations_log_archive')
        );

        expect(mockLogger.info).toHaveBeenCalledWith(
          'Rotated 75 wallet operation records',
          expect.objectContaining({
            recordCount: 75
          }),
          'SYSTEM'
        );
      });
    });

    describe('Error Handling', () => {
      it('should handle rotation errors gracefully', async () => {
        const error = new Error('Database connection failed');
        mockClient.query.mockRejectedValueOnce(error);

        const manager = new LogRotationManager();
        
        await expect(manager.rotateAllLogs()).rejects.toThrow('Database connection failed');

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Log rotation failed',
          error,
          {},
          'SYSTEM'
        );
      });

      it('should release database connection on error', async () => {
        mockClient.query.mockRejectedValueOnce(new Error('Query failed'));

        const manager = new LogRotationManager();
        
        try {
          await manager.rotateAllLogs();
        } catch (error) {
          // Expected to throw
        }

        expect(mockClient.release).toHaveBeenCalled();
      });
    });

    describe('Log Statistics', () => {
      it('should get log statistics', async () => {
        const mockStats = [
          { total: '1000', oldest: '2023-01-01T00:00:00.000Z' }, // system logs
          { total: '50', oldest: '2023-06-01T00:00:00.000Z' },   // security events
          { total: '500', oldest: '2023-03-01T00:00:00.000Z' }   // wallet operations
        ];

        mockClient.query
          .mockResolvedValueOnce({ rows: [mockStats[0]] })
          .mockResolvedValueOnce({ rows: [mockStats[1]] })
          .mockResolvedValueOnce({ rows: [mockStats[2]] });

        const manager = new LogRotationManager();
        const stats = await manager.getLogStatistics();

        expect(stats).toEqual({
          systemLogs: {
            total: 1000,
            oldestEntry: '2023-01-01T00:00:00.000Z'
          },
          securityEvents: {
            total: 50,
            oldestEntry: '2023-06-01T00:00:00.000Z'
          },
          walletOperations: {
            total: 500,
            oldestEntry: '2023-03-01T00:00:00.000Z'
          }
        });
      });

      it('should handle null oldest entries', async () => {
        const mockStats = [
          { total: '0', oldest: null },
          { total: '0', oldest: null },
          { total: '0', oldest: null }
        ];

        mockClient.query
          .mockResolvedValueOnce({ rows: [mockStats[0]] })
          .mockResolvedValueOnce({ rows: [mockStats[1]] })
          .mockResolvedValueOnce({ rows: [mockStats[2]] });

        const manager = new LogRotationManager();
        const stats = await manager.getLogStatistics();

        expect(stats.systemLogs.oldestEntry).toBeNull();
        expect(stats.securityEvents.oldestEntry).toBeNull();
        expect(stats.walletOperations.oldestEntry).toBeNull();
      });
    });
  });

  describe('Utility Functions', () => {
    it('should run log rotation with default policy', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await runLogRotation();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting log rotation process',
        {},
        'SYSTEM'
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Log rotation completed successfully',
        {},
        'SYSTEM'
      );
    });

    it('should run log rotation with custom policy', async () => {
      const customPolicy = {
        systemLogs: { retentionDays: 7, archiveBeforeDelete: false },
        securityEvents: { retentionDays: 30, archiveBeforeDelete: false },
        walletOperations: { retentionDays: 90, archiveBeforeDelete: false }
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await runLogRotation(customPolicy);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Log rotation completed successfully',
        {},
        'SYSTEM'
      );
    });

    it('should get log statistics via utility function', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ total: '100', oldest: '2023-01-01' }] })
        .mockResolvedValueOnce({ rows: [{ total: '10', oldest: '2023-06-01' }] })
        .mockResolvedValueOnce({ rows: [{ total: '50', oldest: '2023-03-01' }] });

      const stats = await getLogStatistics();

      expect(stats).toEqual({
        systemLogs: { total: 100, oldestEntry: '2023-01-01' },
        securityEvents: { total: 10, oldestEntry: '2023-06-01' },
        walletOperations: { total: 50, oldestEntry: '2023-03-01' }
      });
    });
  });

  describe('Default Retention Policy', () => {
    it('should have reasonable default values', () => {
      expect(DEFAULT_RETENTION_POLICY.systemLogs.retentionDays).toBe(90);
      expect(DEFAULT_RETENTION_POLICY.systemLogs.archiveBeforeDelete).toBe(false);

      expect(DEFAULT_RETENTION_POLICY.securityEvents.retentionDays).toBe(365);
      expect(DEFAULT_RETENTION_POLICY.securityEvents.archiveBeforeDelete).toBe(true);

      expect(DEFAULT_RETENTION_POLICY.walletOperations.retentionDays).toBe(730);
      expect(DEFAULT_RETENTION_POLICY.walletOperations.archiveBeforeDelete).toBe(true);
    });

    it('should pass validation', () => {
      expect(() => {
        LogRotationManager.validateRetentionPolicy(DEFAULT_RETENTION_POLICY);
      }).not.toThrow();
    });
  });
});