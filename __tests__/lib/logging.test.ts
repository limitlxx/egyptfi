/**
 * Unit tests for logging system
 */

// Mock database pool
jest.mock('../../lib/db', () => ({
  __esModule: true,
  default: {
    connect: jest.fn()
  }
}));

import { Logger, LogLevel, LogCategory, SecurityEventType, WalletOperationType, AuditTrail } from '../../lib/logging';

// Mock UUID
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123')
}));

// Mock client and pool after imports
const mockClient = {
  query: jest.fn(),
  release: jest.fn()
};

const mockPool = require('../../lib/db').default;

describe('Logging System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.connect.mockResolvedValue(mockClient);
    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Logger', () => {
    describe('Basic Logging', () => {
      it('should create logger with correlation ID', () => {
        const logger = Logger.createWithCorrelationId('test-correlation-id');
        expect(logger.getCorrelationId()).toBe('test-correlation-id');
      });

      it('should create logger with auto-generated correlation ID', () => {
        const logger = Logger.createWithCorrelationId();
        expect(logger.getCorrelationId()).toBe('test-uuid-123');
      });

      it('should log debug messages', () => {
        const logger = Logger.createWithCorrelationId('test-id');
        logger.debug('Test debug message', { key: 'value' });

        expect(console.debug).toHaveBeenCalledWith(
          expect.stringContaining('[DEBUG] [SYSTEM] [test-id] Test debug message')
        );
      });

      it('should log info messages', () => {
        const logger = Logger.createWithCorrelationId('test-id');
        logger.info('Test info message', { key: 'value' }, LogCategory.API_REQUEST);

        expect(console.info).toHaveBeenCalledWith(
          expect.stringContaining('[INFO] [API_REQUEST] [test-id] Test info message')
        );
      });

      it('should log warning messages', () => {
        const logger = Logger.createWithCorrelationId('test-id');
        logger.warn('Test warning message');

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('[WARN] [SYSTEM] [test-id] Test warning message')
        );
      });

      it('should log error messages with error object', () => {
        const logger = Logger.createWithCorrelationId('test-id');
        const error = new Error('Test error');
        logger.error('Test error message', error, { context: 'test' });

        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining('[ERROR] [SYSTEM] [test-id] Test error message')
        );
      });

      it('should log critical messages', () => {
        const logger = Logger.createWithCorrelationId('test-id');
        logger.critical('Critical error', undefined, { severity: 'high' });

        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining('[CRITICAL] [SYSTEM] [test-id] Critical error')
        );
      });
    });

    describe('Security Event Logging', () => {
      it('should log security events', async () => {
        const logger = Logger.createWithCorrelationId('test-id');
        
        logger.logSecurityEvent(
          SecurityEventType.LOGIN_FAILURE,
          'Failed login attempt',
          {
            merchantId: 'merchant-123',
            ipAddress: '192.168.1.1',
            userAgent: 'Test Browser',
            apiKey: 'api-key-12345678',
            severity: 'HIGH'
          }
        );

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('[WARN] [SECURITY] [test-id] Failed login attempt')
        );

        // Wait for async database operation
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO security_events'),
          expect.arrayContaining([
            expect.any(String), // timestamp
            SecurityEventType.LOGIN_FAILURE,
            'Failed login attempt',
            'merchant-123',
            '192.168.1.1',
            'Test Browser',
            'api-********5678', // masked API key
            'HIGH',
            'test-id',
            null
          ])
        );
      });

      it('should mask API keys properly', async () => {
        const logger = Logger.createWithCorrelationId('test-id');
        
        logger.logSecurityEvent(
          SecurityEventType.INVALID_API_KEY,
          'Invalid API key used',
          {
            apiKey: 'short'
          }
        );

        // Wait for async database operation
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO security_events'),
          expect.arrayContaining([
            expect.any(String),
            SecurityEventType.INVALID_API_KEY,
            'Invalid API key used',
            undefined,
            undefined,
            undefined,
            '*****', // fully masked short key
            'MEDIUM',
            'test-id',
            null
          ])
        );
      });
    });

    describe('Wallet Operation Logging', () => {
      it('should log successful wallet operations', async () => {
        const logger = Logger.createWithCorrelationId('test-id');
        
        logger.logWalletOperation(
          WalletOperationType.TRANSFER,
          'completed',
          {
            merchantId: 'merchant-123',
            txHash: '0xabc123',
            contractAddress: '0x123abc',
            amount: '100.5',
            recipient: '0xrecipient',
            environment: 'testnet'
          }
        );

        expect(console.info).toHaveBeenCalledWith(
          expect.stringContaining('[INFO] [WALLET_OPERATION] [test-id] Wallet operation TRANSFER completed (tx: 0xabc123)')
        );

        // Wait for async database operation
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO wallet_operations_log'),
          expect.arrayContaining([
            'merchant-123',
            WalletOperationType.TRANSFER,
            '0x123abc',
            100.5,
            '0xrecipient',
            '0xabc123',
            'completed',
            undefined,
            null,
            expect.any(String), // timestamp
            expect.any(String)  // completed_at
          ])
        );
      });

      it('should log failed wallet operations', async () => {
        const logger = Logger.createWithCorrelationId('test-id');
        
        logger.logWalletOperation(
          WalletOperationType.TRANSFER,
          'failed',
          {
            merchantId: 'merchant-123',
            errorMessage: 'Insufficient balance',
            environment: 'mainnet'
          }
        );

        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining('[ERROR] [WALLET_OPERATION] [test-id] Wallet operation TRANSFER failed')
        );

        // Wait for async database operation
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO wallet_operations_log'),
          expect.arrayContaining([
            'merchant-123',
            WalletOperationType.TRANSFER,
            undefined,
            null,
            undefined,
            undefined,
            'failed',
            'Insufficient balance',
            null,
            expect.any(String), // timestamp
            null // no completed_at for failed operations
          ])
        );
      });
    });

    describe('API Request Logging', () => {
      it('should log successful API requests', () => {
        const logger = Logger.createWithCorrelationId('test-id');
        
        logger.logApiRequest(
          'POST',
          '/api/merchants/wallet/transfer',
          200,
          150,
          {
            merchantId: 'merchant-123',
            ipAddress: '192.168.1.1',
            userAgent: 'Test Client'
          }
        );

        expect(console.info).toHaveBeenCalledWith(
          expect.stringContaining('[INFO] [API_REQUEST] [test-id] POST /api/merchants/wallet/transfer - 200 (150ms)')
        );
      });

      it('should log failed API requests with appropriate log level', () => {
        const logger = Logger.createWithCorrelationId('test-id');
        
        logger.logApiRequest('GET', '/api/test', 500, 1000);

        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining('[ERROR] [API_REQUEST] [test-id] GET /api/test - 500 (1000ms)')
        );
      });

      it('should log client errors with warning level', () => {
        const logger = Logger.createWithCorrelationId('test-id');
        
        logger.logApiRequest('POST', '/api/test', 400, 50);

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('[WARN] [API_REQUEST] [test-id] POST /api/test - 400 (50ms)')
        );
      });
    });

    describe('Database Storage', () => {
      it('should store log entries in database', async () => {
        const logger = Logger.createWithCorrelationId('test-id');
        
        logger.info('Test message', { key: 'value' });

        // Wait for async database operation
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO system_logs'),
          expect.arrayContaining([
            expect.any(String), // timestamp
            LogLevel.INFO,
            LogCategory.SYSTEM,
            'Test message',
            'test-id',
            undefined, // request_id
            undefined, // merchant_id
            undefined, // environment
            '{"key":"value"}' // metadata
          ])
        );
      });

      it('should handle database errors gracefully', async () => {
        mockClient.query.mockRejectedValueOnce(new Error('Database error'));
        
        const logger = Logger.createWithCorrelationId('test-id');
        logger.info('Test message');

        // Wait for async operation and error handling
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(console.error).toHaveBeenCalledWith(
          'Failed to store log entry:',
          expect.any(Error)
        );
      });
    });
  });

  describe('AuditTrail', () => {
    describe('getWalletOperations', () => {
      it('should retrieve wallet operations for merchant', async () => {
        const mockOperations = [
          { id: '1', operation_type: 'TRANSFER', status: 'completed' },
          { id: '2', operation_type: 'APPROVE', status: 'failed' }
        ];
        
        mockClient.query.mockResolvedValueOnce({ rows: mockOperations });

        const result = await AuditTrail.getWalletOperations('merchant-123');

        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('WHERE merchant_id = $1'),
          ['merchant-123', 100, 0]
        );
        expect(result).toEqual(mockOperations);
      });

      it('should filter by operation type', async () => {
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        await AuditTrail.getWalletOperations('merchant-123', {
          operationType: WalletOperationType.TRANSFER
        });

        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('AND operation_type = $2'),
          ['merchant-123', WalletOperationType.TRANSFER, 100, 0]
        );
      });

      it('should filter by status', async () => {
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        await AuditTrail.getWalletOperations('merchant-123', {
          status: 'completed'
        });

        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('AND status = $2'),
          ['merchant-123', 'completed', 100, 0]
        );
      });

      it('should filter by date range', async () => {
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        const startDate = new Date('2023-01-01');
        const endDate = new Date('2023-12-31');

        await AuditTrail.getWalletOperations('merchant-123', {
          startDate,
          endDate
        });

        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('AND created_at >= $2 AND created_at <= $3'),
          ['merchant-123', startDate.toISOString(), endDate.toISOString(), 100, 0]
        );
      });

      it('should apply limit and offset', async () => {
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        await AuditTrail.getWalletOperations('merchant-123', {
          limit: 50,
          offset: 100
        });

        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('LIMIT $2 OFFSET $3'),
          ['merchant-123', 50, 100]
        );
      });
    });

    describe('getSecurityEvents', () => {
      it('should retrieve security events', async () => {
        const mockEvents = [
          { id: '1', event_type: 'LOGIN_FAILURE', severity: 'HIGH' },
          { id: '2', event_type: 'INVALID_API_KEY', severity: 'MEDIUM' }
        ];
        
        mockClient.query.mockResolvedValueOnce({ rows: mockEvents });

        const result = await AuditTrail.getSecurityEvents();

        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM security_events WHERE 1=1'),
          [100, 0]
        );
        expect(result).toEqual(mockEvents);
      });

      it('should filter by merchant ID', async () => {
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        await AuditTrail.getSecurityEvents({
          merchantId: 'merchant-123'
        });

        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('AND merchant_id = $1'),
          ['merchant-123', 100, 0]
        );
      });

      it('should filter by event type', async () => {
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        await AuditTrail.getSecurityEvents({
          eventType: SecurityEventType.LOGIN_FAILURE
        });

        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('AND event_type = $1'),
          [SecurityEventType.LOGIN_FAILURE, 100, 0]
        );
      });

      it('should filter by severity', async () => {
        mockClient.query.mockResolvedValueOnce({ rows: [] });

        await AuditTrail.getSecurityEvents({
          severity: 'HIGH'
        });

        expect(mockClient.query).toHaveBeenCalledWith(
          expect.stringContaining('AND severity = $1'),
          ['HIGH', 100, 0]
        );
      });
    });
  });

  describe('Correlation ID Management', () => {
    it('should maintain correlation ID across log entries', () => {
      const logger = Logger.createWithCorrelationId('test-correlation');
      
      logger.info('First message');
      logger.error('Second message');
      logger.logSecurityEvent(SecurityEventType.LOGIN_SUCCESS, 'Login successful');

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('[test-correlation]')
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[test-correlation]')
      );
    });

    it('should allow updating correlation ID', () => {
      const logger = Logger.createWithCorrelationId('initial-id');
      logger.setCorrelationId('updated-id');
      
      expect(logger.getCorrelationId()).toBe('updated-id');
      
      logger.info('Test message');
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('[updated-id]')
      );
    });
  });
});