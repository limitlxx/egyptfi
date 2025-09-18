/**
 * Unit tests for ChipiPay resilience wrapper
 */

// Mock Logger
jest.mock('../../lib/logging', () => ({
  Logger: {
    createWithCorrelationId: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    }))
  },
  LogLevel: { INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR', DEBUG: 'DEBUG' },
  LogCategory: { SYSTEM: 'SYSTEM', CHIPIPAY: 'CHIPIPAY' }
}));

// Mock NetworkResilienceManager
const mockResilienceManager = {
  executeWithResilience: jest.fn(),
  getCircuitBreakerStatuses: jest.fn(),
  resetCircuitBreaker: jest.fn(),
  resetAllCircuitBreakers: jest.fn()
};

jest.mock('../../lib/retry-logic', () => ({
  NetworkResilienceManager: jest.fn(() => mockResilienceManager),
  CircuitBreakerState: {
    CLOSED: 'CLOSED',
    OPEN: 'OPEN',
    HALF_OPEN: 'HALF_OPEN'
  }
}));

import { ChipiPayResilienceManager } from '../../lib/chipipay-resilience';
import { ErrorCode } from '../../lib/error-handling';

// Get the mocked logger
const mockLogger = require('../../lib/logging').Logger.createWithCorrelationId();

describe('ChipiPay Resilience Manager', () => {
  let chipipayResilience: ChipiPayResilienceManager;

  beforeEach(() => {
    jest.clearAllMocks();
    chipipayResilience = new ChipiPayResilienceManager();
  });

  describe('executeChipiPayCall', () => {
    it('should execute ChipiPay call successfully', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      mockResilienceManager.executeWithResilience.mockResolvedValue('success');

      const result = await chipipayResilience.executeChipiPayCall(
        mockOperation,
        'transfer',
        'merchant-123',
        'testnet'
      );

      expect(result).toBe('success');
      expect(mockResilienceManager.executeWithResilience).toHaveBeenCalledWith(
        mockOperation,
        'chipipay-testnet',
        'ChipiPay transfer',
        expect.objectContaining({
          retryConfig: expect.any(Object),
          circuitBreakerConfig: expect.any(Object)
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Executing ChipiPay transfer with resilience',
        expect.objectContaining({
          operationType: 'transfer',
          merchantId: 'merchant-123',
          environment: 'testnet'
        }),
        'CHIPIPAY'
      );
    });

    it('should handle ChipiPay call failures', async () => {
      const mockError = new Error('Network timeout');
      mockResilienceManager.executeWithResilience.mockRejectedValue(mockError);

      await expect(
        chipipayResilience.executeChipiPayCall(
          jest.fn(),
          'transfer',
          'merchant-123',
          'testnet'
        )
      ).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'ChipiPay transfer failed after resilience attempts',
        mockError,
        expect.objectContaining({
          operationType: 'transfer',
          merchantId: 'merchant-123',
          environment: 'testnet'
        }),
        'CHIPIPAY'
      );
    });

    it('should map timeout errors correctly', async () => {
      const timeoutError = new Error('Operation timed out after 30000ms');
      mockResilienceManager.executeWithResilience.mockRejectedValue(timeoutError);

      try {
        await chipipayResilience.executeChipiPayCall(
          jest.fn(),
          'transfer',
          'merchant-123',
          'testnet'
        );
      } catch (error: any) {
        expect(error.code).toBe(ErrorCode.TIMEOUT_ERROR);
      }
    });

    it('should map network errors correctly', async () => {
      const networkError = new Error('ECONNRESET');
      mockResilienceManager.executeWithResilience.mockRejectedValue(networkError);

      try {
        await chipipayResilience.executeChipiPayCall(
          jest.fn(),
          'transfer',
          'merchant-123',
          'testnet'
        );
      } catch (error: any) {
        expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
      }
    });

    it('should map circuit breaker errors correctly', async () => {
      const circuitError = new Error('Circuit breaker chipipay-testnet is OPEN');
      mockResilienceManager.executeWithResilience.mockRejectedValue(circuitError);

      try {
        await chipipayResilience.executeChipiPayCall(
          jest.fn(),
          'transfer',
          'merchant-123',
          'testnet'
        );
      } catch (error: any) {
        expect(error.code).toBe(ErrorCode.CHIPIPAY_SERVICE_UNAVAILABLE);
      }
    });
  });

  describe('executeWalletCreation', () => {
    it('should execute wallet creation with enhanced resilience', async () => {
      const mockOperation = jest.fn().mockResolvedValue({ walletAddress: '0x123' });
      mockResilienceManager.executeWithResilience.mockResolvedValue({ walletAddress: '0x123' });

      const result = await chipipayResilience.executeWalletCreation(
        mockOperation,
        'merchant-123',
        'mainnet'
      );

      expect(result).toEqual({ walletAddress: '0x123' });
      expect(mockResilienceManager.executeWithResilience).toHaveBeenCalledWith(
        mockOperation,
        'chipipay-wallet-creation-mainnet',
        'ChipiPay Wallet Creation',
        expect.objectContaining({
          retryConfig: expect.objectContaining({
            maxAttempts: 5,
            baseDelayMs: 2000
          })
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Executing ChipiPay Wallet Creation with enhanced resilience',
        expect.objectContaining({
          merchantId: 'merchant-123',
          environment: 'mainnet',
          maxAttempts: 5
        }),
        'CHIPIPAY'
      );
    });

    it('should map wallet creation failures correctly', async () => {
      const walletError = new Error('Wallet creation failed');
      mockResilienceManager.executeWithResilience.mockRejectedValue(walletError);

      try {
        await chipipayResilience.executeWalletCreation(
          jest.fn(),
          'merchant-123',
          'testnet'
        );
      } catch (error: any) {
        expect(error.code).toBe(ErrorCode.WALLET_CREATION_FAILED);
      }
    });
  });

  describe('executeTransaction', () => {
    it('should execute transaction with appropriate resilience', async () => {
      const mockOperation = jest.fn().mockResolvedValue({ txHash: '0xabc123' });
      mockResilienceManager.executeWithResilience.mockResolvedValue({ txHash: '0xabc123' });

      const result = await chipipayResilience.executeTransaction(
        mockOperation,
        'transfer',
        'merchant-123',
        'testnet',
        {
          amount: '100',
          recipient: '0xrecipient',
          contractAddress: '0xcontract'
        }
      );

      expect(result).toEqual({ txHash: '0xabc123' });
      expect(mockResilienceManager.executeWithResilience).toHaveBeenCalledWith(
        mockOperation,
        'chipipay-transaction-testnet',
        'ChipiPay transfer Transaction',
        expect.objectContaining({
          retryConfig: expect.objectContaining({
            maxAttempts: 4,
            baseDelayMs: 1500,
            timeoutMs: 45000
          })
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Executing ChipiPay transfer Transaction with resilience',
        expect.objectContaining({
          operationType: 'transfer',
          merchantId: 'merchant-123',
          environment: 'testnet',
          txDetails: {
            amount: '100',
            recipient: '0xrecipient',
            contractAddress: '0xcontract'
          }
        }),
        'CHIPIPAY'
      );
    });

    it('should map transfer failures correctly', async () => {
      const transferError = new Error('Transfer failed');
      mockResilienceManager.executeWithResilience.mockRejectedValue(transferError);

      try {
        await chipipayResilience.executeTransaction(
          jest.fn(),
          'transfer',
          'merchant-123',
          'testnet'
        );
      } catch (error: any) {
        expect(error.code).toBe(ErrorCode.TRANSFER_FAILED);
      }
    });

    it('should map approve failures correctly', async () => {
      const approveError = new Error('Approval failed');
      mockResilienceManager.executeWithResilience.mockRejectedValue(approveError);

      try {
        await chipipayResilience.executeTransaction(
          jest.fn(),
          'approve',
          'merchant-123',
          'testnet'
        );
      } catch (error: any) {
        expect(error.code).toBe(ErrorCode.APPROVAL_FAILED);
      }
    });

    it('should map contract call failures correctly', async () => {
      const contractError = new Error('Contract call failed');
      mockResilienceManager.executeWithResilience.mockRejectedValue(contractError);

      try {
        await chipipayResilience.executeTransaction(
          jest.fn(),
          'contract-call',
          'merchant-123',
          'testnet'
        );
      } catch (error: any) {
        expect(error.code).toBe(ErrorCode.CONTRACT_CALL_FAILED);
      }
    });
  });

  describe('executeAuthentication', () => {
    it('should execute authentication with fast resilience', async () => {
      const mockOperation = jest.fn().mockResolvedValue({ token: 'auth-token' });
      mockResilienceManager.executeWithResilience.mockResolvedValue({ token: 'auth-token' });

      const result = await chipipayResilience.executeAuthentication(
        mockOperation,
        'merchant-123',
        'testnet'
      );

      expect(result).toEqual({ token: 'auth-token' });
      expect(mockResilienceManager.executeWithResilience).toHaveBeenCalledWith(
        mockOperation,
        'chipipay-auth-testnet',
        'ChipiPay Authentication',
        expect.objectContaining({
          retryConfig: expect.objectContaining({
            maxAttempts: 2,
            baseDelayMs: 500,
            maxDelayMs: 2000,
            timeoutMs: 10000
          })
        })
      );
    });

    it('should map authentication failures correctly', async () => {
      const authError = new Error('Authentication failed');
      mockResilienceManager.executeWithResilience.mockRejectedValue(authError);

      try {
        await chipipayResilience.executeAuthentication(
          jest.fn(),
          'merchant-123',
          'testnet'
        );
      } catch (error: any) {
        expect(error.code).toBe(ErrorCode.CHIPIPAY_AUTHENTICATION_FAILED);
      }
    });
  });

  describe('Service Health Monitoring', () => {
    it('should return healthy status when all services are healthy', () => {
      mockResilienceManager.getCircuitBreakerStatuses.mockReturnValue([
        {
          name: 'chipipay-testnet',
          state: 'CLOSED',
          failureRate: 10,
          metrics: {}
        },
        {
          name: 'chipipay-mainnet',
          state: 'CLOSED',
          failureRate: 5,
          metrics: {}
        }
      ]);

      const health = chipipayResilience.getServiceHealth();

      expect(health.overallHealth).toBe('healthy');
      expect(health.services).toHaveLength(2);
      expect(health.services[0].isHealthy).toBe(true);
      expect(health.services[1].isHealthy).toBe(true);
    });

    it('should return degraded status when some services are unhealthy', () => {
      mockResilienceManager.getCircuitBreakerStatuses.mockReturnValue([
        {
          name: 'chipipay-testnet',
          state: 'CLOSED',
          failureRate: 10,
          metrics: {}
        },
        {
          name: 'chipipay-mainnet',
          state: 'OPEN',
          failureRate: 80,
          metrics: {}
        }
      ]);

      const health = chipipayResilience.getServiceHealth();

      expect(health.overallHealth).toBe('degraded');
      expect(health.services[0].isHealthy).toBe(true);
      expect(health.services[1].isHealthy).toBe(false);
    });

    it('should return unhealthy status when all services are unhealthy', () => {
      mockResilienceManager.getCircuitBreakerStatuses.mockReturnValue([
        {
          name: 'chipipay-testnet',
          state: 'OPEN',
          failureRate: 90,
          metrics: {}
        },
        {
          name: 'chipipay-mainnet',
          state: 'OPEN',
          failureRate: 85,
          metrics: {}
        }
      ]);

      const health = chipipayResilience.getServiceHealth();

      expect(health.overallHealth).toBe('unhealthy');
      expect(health.services[0].isHealthy).toBe(false);
      expect(health.services[1].isHealthy).toBe(false);
    });

    it('should filter only ChipiPay services', () => {
      mockResilienceManager.getCircuitBreakerStatuses.mockReturnValue([
        {
          name: 'chipipay-testnet',
          state: 'CLOSED',
          failureRate: 10,
          metrics: {}
        },
        {
          name: 'other-service',
          state: 'OPEN',
          failureRate: 90,
          metrics: {}
        }
      ]);

      const health = chipipayResilience.getServiceHealth();

      expect(health.services).toHaveLength(1);
      expect(health.services[0].name).toBe('chipipay-testnet');
      expect(health.overallHealth).toBe('healthy');
    });
  });

  describe('Circuit Breaker Management', () => {
    it('should reset ChipiPay circuit breakers', () => {
      mockResilienceManager.getCircuitBreakerStatuses.mockReturnValue([
        { name: 'chipipay-testnet', state: 'OPEN', failureRate: 80, metrics: {} },
        { name: 'chipipay-mainnet', state: 'CLOSED', failureRate: 10, metrics: {} },
        { name: 'other-service', state: 'OPEN', failureRate: 90, metrics: {} }
      ]);

      mockResilienceManager.resetCircuitBreaker.mockReturnValue(true);

      chipipayResilience.resetChipiPayCircuitBreakers();

      expect(mockResilienceManager.resetCircuitBreaker).toHaveBeenCalledWith('chipipay-testnet');
      expect(mockResilienceManager.resetCircuitBreaker).toHaveBeenCalledWith('chipipay-mainnet');
      expect(mockResilienceManager.resetCircuitBreaker).not.toHaveBeenCalledWith('other-service');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'ChipiPay circuit breakers reset',
        expect.objectContaining({
          resetCount: 2,
          services: ['chipipay-testnet', 'chipipay-mainnet']
        }),
        'CHIPIPAY'
      );
    });

    it('should get detailed metrics', () => {
      const mockMetrics = [
        {
          name: 'chipipay-testnet',
          state: 'CLOSED',
          failureRate: 15,
          metrics: { successCount: 85, failureCount: 15 }
        },
        {
          name: 'chipipay-mainnet',
          state: 'OPEN',
          failureRate: 75,
          metrics: { successCount: 25, failureCount: 75 }
        }
      ];

      mockResilienceManager.getCircuitBreakerStatuses.mockReturnValue([
        ...mockMetrics,
        { name: 'other-service', state: 'CLOSED', failureRate: 5, metrics: {} }
      ]);

      const metrics = chipipayResilience.getMetrics();

      expect(metrics.circuitBreakers).toHaveLength(2);
      expect(metrics.circuitBreakers).toEqual(mockMetrics);
      expect(metrics.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('Error Mapping', () => {
    const testCases = [
      {
        error: new Error('timeout occurred'),
        operationType: 'transfer',
        expectedCode: ErrorCode.TIMEOUT_ERROR
      },
      {
        error: new Error('ETIMEDOUT'),
        operationType: 'approve',
        expectedCode: ErrorCode.TIMEOUT_ERROR
      },
      {
        error: new Error('ECONNRESET'),
        operationType: 'stake',
        expectedCode: ErrorCode.NETWORK_ERROR
      },
      {
        error: new Error('ENOTFOUND'),
        operationType: 'withdraw',
        expectedCode: ErrorCode.NETWORK_ERROR
      },
      {
        error: new Error('network error'),
        operationType: 'contract-call',
        expectedCode: ErrorCode.NETWORK_ERROR
      },
      {
        error: new Error('service unavailable'),
        operationType: 'transfer',
        expectedCode: ErrorCode.CHIPIPAY_SERVICE_UNAVAILABLE
      },
      {
        error: new Error('unauthorized access'),
        operationType: 'authentication',
        expectedCode: ErrorCode.CHIPIPAY_AUTHENTICATION_FAILED
      },
      {
        error: new Error('unknown error'),
        operationType: 'wallet-creation',
        expectedCode: ErrorCode.WALLET_CREATION_FAILED
      },
      {
        error: new Error('unknown error'),
        operationType: 'transfer',
        expectedCode: ErrorCode.TRANSFER_FAILED
      },
      {
        error: new Error('unknown error'),
        operationType: 'approve',
        expectedCode: ErrorCode.APPROVAL_FAILED
      },
      {
        error: new Error('unknown error'),
        operationType: 'contract-call',
        expectedCode: ErrorCode.CONTRACT_CALL_FAILED
      },
      {
        error: new Error('unknown error'),
        operationType: 'unknown',
        expectedCode: ErrorCode.CHIPIPAY_API_ERROR
      }
    ];

    testCases.forEach(({ error, operationType, expectedCode }) => {
      it(`should map ${error.message} for ${operationType} to ${expectedCode}`, async () => {
        mockResilienceManager.executeWithResilience.mockRejectedValue(error);

        try {
          await chipipayResilience.executeChipiPayCall(
            jest.fn(),
            operationType,
            'merchant-123',
            'testnet'
          );
        } catch (mappedError: any) {
          expect(mappedError.code).toBe(expectedCode);
          expect(mappedError.message).toBe(error.message);
        }
      });
    });
  });
});