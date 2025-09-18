/**
 * Unit tests for retry logic and network resilience system
 */

import { 
  RetryManager, 
  CircuitBreaker, 
  NetworkResilienceManager,
  CircuitBreakerState,
  RetryConfig,
  CircuitBreakerConfig 
} from '../../lib/retry-logic';

// Mock the logger
jest.mock('../../lib/logging', () => ({
  Logger: {
    createWithCorrelationId: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    }))
  },
  LogCategory: {
    SYSTEM: 'SYSTEM',
    NETWORK: 'NETWORK'
  }
}));

describe('Retry Logic and Network Resilience', () => {
  let mockLogger: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    const { Logger } = require('../../lib/logging');
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    Logger.createWithCorrelationId.mockReturnValue(mockLogger);
  });

  describe('RetryManager', () => {
    let retryManager: RetryManager;

    beforeEach(() => {
      retryManager = new RetryManager();
    });

    describe('executeWithRetry', () => {
      it('should succeed on first attempt', async () => {
        const mockOperation = jest.fn().mockResolvedValue('success');
        
        const result = await retryManager.executeWithRetry(
          mockOperation,
          'test-operation'
        );

        expect(result.success).toBe(true);
        expect(result.result).toBe('success');
        expect(result.attempts).toHaveLength(1);
        expect(mockOperation).toHaveBeenCalledTimes(1);
      });

      it('should retry on retryable errors', async () => {
        const mockOperation = jest.fn()
          .mockRejectedValueOnce(new Error('ECONNRESET'))
          .mockRejectedValueOnce(new Error('ETIMEDOUT'))
          .mockResolvedValue('success');

        const result = await retryManager.executeWithRetry(
          mockOperation,
          'test-operation',
          { baseDelay: 1, maxDelay: 1 } // Very short delays for testing
        );

        expect(result.success).toBe(true);
        expect(result.result).toBe('success');
        expect(result.attempts).toHaveLength(3);
        expect(mockOperation).toHaveBeenCalledTimes(3);
      }, 10000);

      it('should fail after max attempts', async () => {
        const error = new Error('ECONNRESET');
        const mockOperation = jest.fn().mockRejectedValue(error);

        const result = await retryManager.executeWithRetry(
          mockOperation,
          'test-operation',
          { maxAttempts: 2, baseDelay: 1, maxDelay: 1 }
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe(error);
        expect(result.attempts).toHaveLength(2);
        expect(mockOperation).toHaveBeenCalledTimes(2);
      }, 10000);

      it('should not retry non-retryable errors', async () => {
        const error = new Error('VALIDATION_ERROR');
        const mockOperation = jest.fn().mockRejectedValue(error);

        const result = await retryManager.executeWithRetry(
          mockOperation,
          'test-operation'
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe(error);
        expect(result.attempts).toHaveLength(1);
        expect(mockOperation).toHaveBeenCalledTimes(1);
      });

      it('should respect timeout', async () => {
        const mockOperation = jest.fn(() => 
          new Promise(resolve => setTimeout(resolve, 5000))
        );

        const promise = retryManager.executeWithRetry(
          mockOperation,
          'test-operation',
          { timeout: 1000 }
        );

        // Fast-forward past timeout
        jest.advanceTimersByTime(2000);

        const result = await promise;

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain('timeout');
      });

      it('should apply exponential backoff with jitter', async () => {
        const mockOperation = jest.fn()
          .mockRejectedValueOnce(new Error('ECONNRESET'))
          .mockRejectedValueOnce(new Error('ECONNRESET'))
          .mockResolvedValue('success');

        const config: Partial<RetryConfig> = {
          baseDelay: 1000,
          backoffMultiplier: 2,
          jitter: true
        };

        const promise = retryManager.executeWithRetry(
          mockOperation,
          'test-operation',
          config
        );

        // Fast-forward through delays
        jest.advanceTimersByTime(10000);

        const result = await promise;

        expect(result.success).toBe(true);
        expect(result.attempts).toHaveLength(3);
        
        // Check that delays increase (with some tolerance for jitter)
        const delays = result.attempts.slice(1).map(a => a.delay);
        expect(delays[0]).toBeGreaterThan(800); // ~1000ms with jitter
        expect(delays[1]).toBeGreaterThan(1600); // ~2000ms with jitter
      });

      it('should handle custom retry configuration', async () => {
        const mockOperation = jest.fn().mockRejectedValue(new Error('CUSTOM_ERROR'));

        const customConfig: Partial<RetryConfig> = {
          maxAttempts: 5,
          retryableErrors: ['CUSTOM_ERROR'],
          baseDelay: 500
        };

        const promise = retryManager.executeWithRetry(
          mockOperation,
          'test-operation',
          customConfig
        );

        jest.advanceTimersByTime(20000);

        const result = await promise;

        expect(result.success).toBe(false);
        expect(result.attempts).toHaveLength(5);
        expect(mockOperation).toHaveBeenCalledTimes(5);
      });
    });

    describe('calculateDelay', () => {
      it('should calculate exponential backoff correctly', () => {
        const config: RetryConfig = {
          maxAttempts: 3,
          baseDelay: 1000,
          maxDelay: 10000,
          backoffMultiplier: 2,
          jitter: false,
          retryableErrors: [],
          timeout: 30000
        };

        // Access private method through any cast for testing
        const delay1 = (retryManager as any).calculateDelay(1, config);
        const delay2 = (retryManager as any).calculateDelay(2, config);
        const delay3 = (retryManager as any).calculateDelay(3, config);

        expect(delay1).toBe(1000);
        expect(delay2).toBe(2000);
        expect(delay3).toBe(4000);
      });

      it('should respect max delay', () => {
        const config: RetryConfig = {
          maxAttempts: 10,
          baseDelay: 1000,
          maxDelay: 5000,
          backoffMultiplier: 2,
          jitter: false,
          retryableErrors: [],
          timeout: 30000
        };

        const delay = (retryManager as any).calculateDelay(10, config);
        expect(delay).toBe(5000);
      });
    });
  });

  describe('CircuitBreaker', () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker('test-service');
    });

    describe('State Management', () => {
      it('should start in CLOSED state', () => {
        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
      });

      it('should open circuit after failure threshold', async () => {
        const config: Partial<CircuitBreakerConfig> = {
          failureThreshold: 0.5,
          minimumThroughput: 2
        };
        
        circuitBreaker = new CircuitBreaker('test-service', config);

        // Record failures
        await circuitBreaker.recordFailure();
        await circuitBreaker.recordFailure();
        await circuitBreaker.recordSuccess(); // 2/3 = 66% failure rate

        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
      });

      it('should transition to HALF_OPEN after recovery timeout', async () => {
        const config: Partial<CircuitBreakerConfig> = {
          failureThreshold: 0.5,
          minimumThroughput: 1,
          recoveryTimeout: 1000
        };
        
        circuitBreaker = new CircuitBreaker('test-service', config);

        // Force circuit to open
        await circuitBreaker.recordFailure();
        await circuitBreaker.recordFailure();
        
        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

        // Fast-forward past recovery timeout
        jest.advanceTimersByTime(1500);

        // Next call should transition to HALF_OPEN
        const canExecute = await circuitBreaker.canExecute();
        expect(canExecute).toBe(true);
        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);
      });

      it('should close circuit after successful execution in HALF_OPEN', async () => {
        // Force to HALF_OPEN state
        circuitBreaker = new CircuitBreaker('test-service', {
          failureThreshold: 0.5,
          minimumThroughput: 1
        });
        
        await circuitBreaker.recordFailure();
        await circuitBreaker.recordFailure();
        jest.advanceTimersByTime(60000);
        await circuitBreaker.canExecute(); // Transition to HALF_OPEN

        // Record success should close circuit
        await circuitBreaker.recordSuccess();
        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
      });

      it('should reopen circuit on failure in HALF_OPEN', async () => {
        // Force to HALF_OPEN state
        circuitBreaker = new CircuitBreaker('test-service', {
          failureThreshold: 0.5,
          minimumThroughput: 1
        });
        
        await circuitBreaker.recordFailure();
        await circuitBreaker.recordFailure();
        jest.advanceTimersByTime(60000);
        await circuitBreaker.canExecute(); // Transition to HALF_OPEN

        // Record failure should reopen circuit
        await circuitBreaker.recordFailure();
        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
      });
    });

    describe('Execution Control', () => {
      it('should allow execution when CLOSED', async () => {
        const canExecute = await circuitBreaker.canExecute();
        expect(canExecute).toBe(true);
      });

      it('should block execution when OPEN', async () => {
        // Force circuit to open
        await circuitBreaker.recordFailure();
        await circuitBreaker.recordFailure();

        const canExecute = await circuitBreaker.canExecute();
        expect(canExecute).toBe(false);
      });

      it('should allow limited execution when HALF_OPEN', async () => {
        // Force to HALF_OPEN
        await circuitBreaker.recordFailure();
        await circuitBreaker.recordFailure();
        jest.advanceTimersByTime(60000);

        const canExecute = await circuitBreaker.canExecute();
        expect(canExecute).toBe(true);
        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);
      });
    });

    describe('Statistics', () => {
      it('should track success and failure counts', async () => {
        await circuitBreaker.recordSuccess();
        await circuitBreaker.recordSuccess();
        await circuitBreaker.recordFailure();

        const stats = circuitBreaker.getStats();
        expect(stats.totalRequests).toBe(3);
        expect(stats.successfulRequests).toBe(2);
        expect(stats.failedRequests).toBe(1);
      });

      it('should reset stats after monitoring period', async () => {
        await circuitBreaker.recordSuccess();
        await circuitBreaker.recordFailure();

        // Fast-forward past monitoring period
        jest.advanceTimersByTime(70000);

        await circuitBreaker.recordSuccess();
        const stats = circuitBreaker.getStats();
        
        expect(stats.totalRequests).toBe(1);
        expect(stats.successfulRequests).toBe(1);
        expect(stats.failedRequests).toBe(0);
      });
    });
  });

  describe('NetworkResilienceManager', () => {
    let resilienceManager: NetworkResilienceManager;

    beforeEach(() => {
      resilienceManager = new NetworkResilienceManager();
    });

    describe('executeWithResilience', () => {
      it('should execute operation with both retry and circuit breaker', async () => {
        const mockOperation = jest.fn().mockResolvedValue('success');

        const result = await resilienceManager.executeWithResilience(
          mockOperation,
          'test-service',
          'test-operation'
        );

        expect(result.success).toBe(true);
        expect(result.result).toBe('success');
        expect(result.circuitBreakerTripped).toBe(false);
      });

      it('should fail fast when circuit breaker is open', async () => {
        const mockOperation = jest.fn().mockResolvedValue('success');

        // Force circuit breaker to open
        const circuitBreaker = resilienceManager.getCircuitBreaker('test-service');
        await circuitBreaker.recordFailure();
        await circuitBreaker.recordFailure();

        const result = await resilienceManager.executeWithResilience(
          mockOperation,
          'test-service',
          'test-operation'
        );

        expect(result.success).toBe(false);
        expect(result.circuitBreakerTripped).toBe(true);
        expect(mockOperation).not.toHaveBeenCalled();
      });

      it('should record circuit breaker stats based on retry results', async () => {
        const mockOperation = jest.fn()
          .mockRejectedValueOnce(new Error('ECONNRESET'))
          .mockResolvedValue('success');

        const promise = resilienceManager.executeWithResilience(
          mockOperation,
          'test-service',
          'test-operation'
        );

        jest.advanceTimersByTime(5000);

        const result = await promise;

        expect(result.success).toBe(true);
        
        const circuitBreaker = resilienceManager.getCircuitBreaker('test-service');
        const stats = circuitBreaker.getStats();
        expect(stats.successfulRequests).toBe(1);
        expect(stats.failedRequests).toBe(0); // Overall operation succeeded
      });

      it('should handle fallback operations', async () => {
        const mockOperation = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
        const mockFallback = jest.fn().mockResolvedValue('fallback-result');

        const promise = resilienceManager.executeWithResilience(
          mockOperation,
          'test-service',
          'test-operation',
          {},
          {},
          mockFallback
        );

        jest.advanceTimersByTime(10000);

        const result = await promise;

        expect(result.success).toBe(true);
        expect(result.result).toBe('fallback-result');
        expect(result.fallbackUsed).toBe(true);
        expect(mockFallback).toHaveBeenCalled();
      });

      it('should fail if both operation and fallback fail', async () => {
        const mockOperation = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
        const mockFallback = jest.fn().mockRejectedValue(new Error('FALLBACK_ERROR'));

        const promise = resilienceManager.executeWithResilience(
          mockOperation,
          'test-service',
          'test-operation',
          {},
          {},
          mockFallback
        );

        jest.advanceTimersByTime(10000);

        const result = await promise;

        expect(result.success).toBe(false);
        expect(result.fallbackUsed).toBe(true);
        expect(result.error?.message).toBe('FALLBACK_ERROR');
      });
    });

    describe('Circuit Breaker Management', () => {
      it('should create circuit breakers per service', () => {
        const cb1 = resilienceManager.getCircuitBreaker('service-1');
        const cb2 = resilienceManager.getCircuitBreaker('service-2');
        const cb1Again = resilienceManager.getCircuitBreaker('service-1');

        expect(cb1).not.toBe(cb2);
        expect(cb1).toBe(cb1Again);
      });

      it('should get all circuit breaker stats', async () => {
        // Create some circuit breakers and record stats
        const cb1 = resilienceManager.getCircuitBreaker('service-1');
        const cb2 = resilienceManager.getCircuitBreaker('service-2');

        await cb1.recordSuccess();
        await cb2.recordFailure();

        const allStats = resilienceManager.getAllCircuitBreakerStats();

        expect(allStats).toHaveProperty('service-1');
        expect(allStats).toHaveProperty('service-2');
        expect(allStats['service-1'].successfulRequests).toBe(1);
        expect(allStats['service-2'].failedRequests).toBe(1);
      });
    });

    describe('Health Monitoring', () => {
      it('should report healthy services', () => {
        const cb = resilienceManager.getCircuitBreaker('healthy-service');
        
        const health = resilienceManager.getHealthStatus();
        
        expect(health.overall).toBe('healthy');
        expect(health.services['healthy-service']).toBe('healthy');
      });

      it('should report degraded services with open circuit breakers', async () => {
        const cb = resilienceManager.getCircuitBreaker('degraded-service');
        
        // Force circuit to open
        await cb.recordFailure();
        await cb.recordFailure();

        const health = resilienceManager.getHealthStatus();
        
        expect(health.overall).toBe('degraded');
        expect(health.services['degraded-service']).toBe('degraded');
      });

      it('should report unhealthy when multiple services are down', async () => {
        const cb1 = resilienceManager.getCircuitBreaker('service-1');
        const cb2 = resilienceManager.getCircuitBreaker('service-2');
        
        // Force both circuits to open
        await cb1.recordFailure();
        await cb1.recordFailure();
        await cb2.recordFailure();
        await cb2.recordFailure();

        const health = resilienceManager.getHealthStatus();
        
        expect(health.overall).toBe('unhealthy');
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle complex retry scenarios with circuit breaker', async () => {
      const resilienceManager = new NetworkResilienceManager();
      let callCount = 0;
      
      const mockOperation = jest.fn(() => {
        callCount++;
        if (callCount <= 5) {
          return Promise.reject(new Error('ECONNRESET'));
        }
        return Promise.resolve('success');
      });

      const promise = resilienceManager.executeWithResilience(
        mockOperation,
        'flaky-service',
        'test-operation',
        { maxAttempts: 3 }, // Will fail after 3 attempts
        { failureThreshold: 0.8, minimumThroughput: 1 }
      );

      jest.advanceTimersByTime(10000);

      const result = await promise;

      expect(result.success).toBe(false);
      expect(mockOperation).toHaveBeenCalledTimes(3);
      
      // Circuit breaker should record the failure
      const cb = resilienceManager.getCircuitBreaker('flaky-service');
      const stats = cb.getStats();
      expect(stats.failedRequests).toBe(1);
    });
  });
});