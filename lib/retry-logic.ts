/**
 * Retry logic and network resilience system
 * Implements exponential backoff, circuit breaker pattern, and timeout handling
 */

import { Logger, LogLevel, LogCategory } from './logging';
import { ErrorCode, createErrorResponse } from './error-handling';

// Retry configuration interface
export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterMs?: number;
  retryableErrors?: string[];
  timeoutMs?: number;
}

// Circuit breaker configuration
export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeoutMs: number;
  monitoringWindowMs: number;
  minimumThroughput: number;
}

// Circuit breaker states
export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

// Default configurations
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterMs: 100,
  retryableErrors: [
    'NETWORK_ERROR',
    'TIMEOUT_ERROR',
    'CONNECTION_FAILED',
    'CHIPIPAY_SERVICE_UNAVAILABLE',
    'DATABASE_ERROR'
  ],
  timeoutMs: 30000
};

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeoutMs: 60000,
  monitoringWindowMs: 60000,
  minimumThroughput: 10
};

// Retry result interface
export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalDuration: number;
}

// Circuit breaker metrics
interface CircuitBreakerMetrics {
  successCount: number;
  failureCount: number;
  timeoutCount: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  requestCount: number;
  windowStart: number;
}

/**
 * Retry utility with exponential backoff
 */
export class RetryManager {
  private logger: Logger;
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
    this.logger = Logger.createWithCorrelationId();
  }

  /**
   * Executes an operation with retry logic
   */
  async execute<T>(
    operation: () => Promise<T>,
    context: string = 'Operation',
    customConfig?: Partial<RetryConfig>
  ): Promise<RetryResult<T>> {
    const config = { ...this.config, ...customConfig };
    const startTime = Date.now();
    let lastError: Error | undefined;

    this.logger.info(`Starting ${context} with retry logic`, {
      maxAttempts: config.maxAttempts,
      baseDelayMs: config.baseDelayMs,
      timeoutMs: config.timeoutMs
    }, LogCategory.SYSTEM);

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        this.logger.debug(`${context} attempt ${attempt}/${config.maxAttempts}`, {
          attempt,
          maxAttempts: config.maxAttempts
        }, LogCategory.SYSTEM);

        // Execute operation with timeout
        const result = await this.executeWithTimeout(operation, config.timeoutMs);
        
        const totalDuration = Date.now() - startTime;
        
        this.logger.info(`${context} succeeded on attempt ${attempt}`, {
          attempt,
          totalDuration,
          success: true
        }, LogCategory.SYSTEM);

        return {
          success: true,
          data: result,
          attempts: attempt,
          totalDuration
        };

      } catch (error) {
        lastError = error as Error;
        const totalDuration = Date.now() - startTime;

        this.logger.warn(`${context} failed on attempt ${attempt}`, {
          attempt,
          maxAttempts: config.maxAttempts,
          error: lastError.message,
          totalDuration
        }, LogCategory.SYSTEM);

        // Check if error is retryable
        if (!this.isRetryableError(lastError, config.retryableErrors)) {
          this.logger.error(`${context} failed with non-retryable error`, lastError, {
            attempt,
            totalDuration
          }, LogCategory.SYSTEM);

          return {
            success: false,
            error: lastError,
            attempts: attempt,
            totalDuration
          };
        }

        // Don't delay after the last attempt
        if (attempt < config.maxAttempts) {
          const delay = this.calculateDelay(attempt, config);
          
          this.logger.debug(`Waiting ${delay}ms before retry`, {
            attempt,
            delay,
            nextAttempt: attempt + 1
          }, LogCategory.SYSTEM);

          await this.sleep(delay);
        }
      }
    }

    const totalDuration = Date.now() - startTime;
    
    this.logger.error(`${context} failed after all retry attempts`, lastError, {
      attempts: config.maxAttempts,
      totalDuration
    }, LogCategory.SYSTEM);

    return {
      success: false,
      error: lastError,
      attempts: config.maxAttempts,
      totalDuration
    };
  }

  /**
   * Executes operation with timeout
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs?: number
  ): Promise<T> {
    if (!timeoutMs) {
      return await operation();
    }

    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Calculates delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
    
    // Add jitter to prevent thundering herd
    const jitter = config.jitterMs ? Math.random() * config.jitterMs : 0;
    
    return Math.floor(cappedDelay + jitter);
  }

  /**
   * Checks if an error is retryable
   */
  private isRetryableError(error: Error, retryableErrors?: string[]): boolean {
    if (!retryableErrors) {
      return true; // Retry all errors by default
    }

    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();

    return retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError.toLowerCase()) ||
      errorName.includes(retryableError.toLowerCase())
    );
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker {
  private logger: Logger;
  private config: CircuitBreakerConfig;
  private state: CircuitBreakerState;
  private metrics: CircuitBreakerMetrics;
  private name: string;

  constructor(name: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.name = name;
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
    this.logger = Logger.createWithCorrelationId();
    this.state = CircuitBreakerState.CLOSED;
    this.metrics = this.resetMetrics();
  }

  /**
   * Executes an operation through the circuit breaker
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.updateMetricsWindow();

    // Check if circuit is open
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.logger.info(`Circuit breaker ${this.name} transitioning to HALF_OPEN`, {
          state: this.state,
          metrics: this.metrics
        }, LogCategory.SYSTEM);
      } else {
        const error = new Error(`Circuit breaker ${this.name} is OPEN`);
        this.logger.warn(`Circuit breaker ${this.name} rejecting request`, {
          state: this.state,
          lastFailureTime: this.metrics.lastFailureTime
        }, LogCategory.SYSTEM);
        throw error;
      }
    }

    const startTime = Date.now();

    try {
      const result = await operation();
      this.onSuccess(Date.now() - startTime);
      return result;
    } catch (error) {
      this.onFailure(Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Handles successful operation
   */
  private onSuccess(duration: number): void {
    this.metrics.successCount++;
    this.metrics.requestCount++;
    this.metrics.lastSuccessTime = Date.now();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.CLOSED;
      this.logger.info(`Circuit breaker ${this.name} transitioning to CLOSED`, {
        state: this.state,
        metrics: this.metrics
      }, LogCategory.SYSTEM);
    }

    this.logger.debug(`Circuit breaker ${this.name} recorded success`, {
      duration,
      state: this.state,
      successCount: this.metrics.successCount
    }, LogCategory.SYSTEM);
  }

  /**
   * Handles failed operation
   */
  private onFailure(duration: number): void {
    this.metrics.failureCount++;
    this.metrics.requestCount++;
    this.metrics.lastFailureTime = Date.now();

    this.logger.warn(`Circuit breaker ${this.name} recorded failure`, {
      duration,
      state: this.state,
      failureCount: this.metrics.failureCount,
      failureRate: this.getFailureRate()
    }, LogCategory.SYSTEM);

    if (this.shouldOpenCircuit()) {
      this.state = CircuitBreakerState.OPEN;
      this.logger.error(`Circuit breaker ${this.name} transitioning to OPEN`, {
        state: this.state,
        metrics: this.metrics,
        failureRate: this.getFailureRate()
      }, LogCategory.SYSTEM);
    }
  }

  /**
   * Checks if circuit should be opened
   */
  private shouldOpenCircuit(): boolean {
    if (this.metrics.requestCount < this.config.minimumThroughput) {
      return false;
    }

    const failureRate = this.getFailureRate();
    return failureRate >= (this.config.failureThreshold / 100);
  }

  /**
   * Checks if circuit should attempt reset
   */
  private shouldAttemptReset(): boolean {
    const timeSinceLastFailure = Date.now() - this.metrics.lastFailureTime;
    return timeSinceLastFailure >= this.config.recoveryTimeoutMs;
  }

  /**
   * Gets current failure rate
   */
  private getFailureRate(): number {
    if (this.metrics.requestCount === 0) {
      return 0;
    }
    return (this.metrics.failureCount / this.metrics.requestCount) * 100;
  }

  /**
   * Updates metrics window
   */
  private updateMetricsWindow(): void {
    const now = Date.now();
    if (now - this.metrics.windowStart >= this.config.monitoringWindowMs) {
      this.metrics = this.resetMetrics();
    }
  }

  /**
   * Resets metrics
   */
  private resetMetrics(): CircuitBreakerMetrics {
    return {
      successCount: 0,
      failureCount: 0,
      timeoutCount: 0,
      lastFailureTime: 0,
      lastSuccessTime: 0,
      requestCount: 0,
      windowStart: Date.now()
    };
  }

  /**
   * Gets current circuit breaker status
   */
  getStatus(): {
    name: string;
    state: CircuitBreakerState;
    metrics: CircuitBreakerMetrics;
    failureRate: number;
  } {
    return {
      name: this.name,
      state: this.state,
      metrics: { ...this.metrics },
      failureRate: this.getFailureRate()
    };
  }

  /**
   * Manually resets the circuit breaker
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.metrics = this.resetMetrics();
    
    this.logger.info(`Circuit breaker ${this.name} manually reset`, {
      state: this.state
    }, LogCategory.SYSTEM);
  }
}

/**
 * Network resilience manager combining retry and circuit breaker
 */
export class NetworkResilienceManager {
  private retryManager: RetryManager;
  private circuitBreakers: Map<string, CircuitBreaker>;
  private logger: Logger;

  constructor(
    retryConfig?: Partial<RetryConfig>,
    circuitBreakerConfig?: Partial<CircuitBreakerConfig>
  ) {
    this.retryManager = new RetryManager(retryConfig);
    this.circuitBreakers = new Map();
    this.logger = Logger.createWithCorrelationId();
  }

  /**
   * Executes operation with both retry logic and circuit breaker
   */
  async executeWithResilience<T>(
    operation: () => Promise<T>,
    serviceName: string,
    context: string = 'Operation',
    options: {
      retryConfig?: Partial<RetryConfig>;
      circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
      skipCircuitBreaker?: boolean;
    } = {}
  ): Promise<T> {
    const { retryConfig, circuitBreakerConfig, skipCircuitBreaker = false } = options;

    // Get or create circuit breaker for service
    let circuitBreaker: CircuitBreaker | undefined;
    if (!skipCircuitBreaker) {
      if (!this.circuitBreakers.has(serviceName)) {
        this.circuitBreakers.set(serviceName, new CircuitBreaker(serviceName, circuitBreakerConfig));
      }
      circuitBreaker = this.circuitBreakers.get(serviceName);
    }

    // Wrap operation with circuit breaker if enabled
    const wrappedOperation = circuitBreaker 
      ? () => circuitBreaker!.execute(operation)
      : operation;

    // Execute with retry logic
    const result = await this.retryManager.execute(wrappedOperation, context, retryConfig);

    if (!result.success) {
      throw result.error || new Error(`${context} failed after all attempts`);
    }

    return result.data!;
  }

  /**
   * Gets status of all circuit breakers
   */
  getCircuitBreakerStatuses(): Array<{
    name: string;
    state: CircuitBreakerState;
    metrics: CircuitBreakerMetrics;
    failureRate: number;
  }> {
    return Array.from(this.circuitBreakers.values()).map(cb => cb.getStatus());
  }

  /**
   * Resets a specific circuit breaker
   */
  resetCircuitBreaker(serviceName: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(serviceName);
    if (circuitBreaker) {
      circuitBreaker.reset();
      return true;
    }
    return false;
  }

  /**
   * Resets all circuit breakers
   */
  resetAllCircuitBreakers(): void {
    this.circuitBreakers.forEach(cb => cb.reset());
    this.logger.info('All circuit breakers reset', {
      count: this.circuitBreakers.size
    }, LogCategory.SYSTEM);
  }
}

// Export singleton instance
export const networkResilience = new NetworkResilienceManager();