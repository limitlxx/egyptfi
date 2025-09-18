/**
 * Retry logic and network resilience system
<<<<<<< HEAD
 * Implements exponential backoff, circuit breaker pattern, and fallback mechanisms
 */

import { Logger, LogCategory } from './logging';
=======
 * Implements exponential backoff, circuit breaker pattern, and timeout handling
 */

import { Logger, LogLevel, LogCategory } from './logging';
>>>>>>> backend
import { ErrorCode, createErrorResponse } from './error-handling';

// Retry configuration interface
export interface RetryConfig {
  maxAttempts: number;
<<<<<<< HEAD
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors: string[];
  timeout: number; // milliseconds
=======
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
>>>>>>> backend
}

// Circuit breaker states
export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

<<<<<<< HEAD
// Circuit breaker configuration
export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number; // milliseconds
  monitoringPeriod: number; // milliseconds
  minimumThroughput: number;
}

// Default configurations
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
  retryableErrors: [
    'ECONNRESET',
    'ENOTFOUND',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'NETWORK_ERROR',
    'TIMEOUT_ERROR',
    'CHIPIPAY_API_ERROR'
  ],
  timeout: 30000
};

const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 0.5, // 50% failure rate
  recoveryTimeout: 60000, // 1 minute
  monitoringPeriod: 60000, // 1 minute
  minimumThroughput: 10 // minimum requests before circuit can open
};

// Circuit breaker statistics
interface CircuitBreakerStats {
  totalRequests: number;
  failedRequests: number;
  successfulRequests: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  windowStart: number;
}

// Retry attempt information
export interface RetryAttempt {
  attempt: number;
  delay: number;
  error?: Error;
  timestamp: number;
}

// Retry result
export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: RetryAttempt[];
  totalTime: number;
  circuitBreakerTripped?: boolean;
  fallbackUsed?: boolean;
}

/**
 * Exponential backoff retry mechanism
=======
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
>>>>>>> backend
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
<<<<<<< HEAD
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string,
    customConfig?: Partial<RetryConfig>
  ): Promise<RetryResult<T>> {
    const config = { ...this.config, ...customConfig };
    const attempts: RetryAttempt[] = [];
    const startTime = Date.now();

    this.logger.info(
      `Starting retry operation: ${context}`,
      { maxAttempts: config.maxAttempts, timeout: config.timeout },
      LogCategory.SYSTEM
    );

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      const attemptStart = Date.now();
      
      try {
        // Set timeout for the operation
        const result = await this.withTimeout(operation(), config.timeout);
        
        const attemptInfo: RetryAttempt = {
          attempt,
          delay: 0,
          timestamp: attemptStart
        };
        attempts.push(attemptInfo);

        this.logger.info(
          `Operation succeeded on attempt ${attempt}`,
          { context, attempt, totalTime: Date.now() - startTime },
          LogCategory.SYSTEM
        );

        return {
          success: true,
          result,
          attempts,
          totalTime: Date.now() - startTime
        };

      } catch (error) {
        const attemptInfo: RetryAttempt = {
          attempt,
          delay: 0,
          error: error as Error,
          timestamp: attemptStart
        };
        attempts.push(attemptInfo);

        const isRetryable = this.isRetryableError(error as Error, config);
        const isLastAttempt = attempt === config.maxAttempts;

        this.logger.warn(
          `Operation failed on attempt ${attempt}`,
          {
            context,
            attempt,
            error: (error as Error).message,
            isRetryable,
            isLastAttempt
          },
          LogCategory.SYSTEM
        );

        if (!isRetryable || isLastAttempt) {
          return {
            success: false,
            error: error as Error,
            attempts,
            totalTime: Date.now() - startTime
          };
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt, config);
        attemptInfo.delay = delay;

        this.logger.info(
          `Retrying in ${delay}ms`,
          { context, attempt, delay },
          LogCategory.SYSTEM
        );

        await this.sleep(delay);
      }
    }

    // This should never be reached, but TypeScript requires it
    return {
      success: false,
      error: new Error('Unexpected retry loop exit'),
      attempts,
      totalTime: Date.now() - startTime
=======
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
>>>>>>> backend
    };
  }

  /**
<<<<<<< HEAD
   * Wraps a promise with a timeout
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timeoutId));
=======
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
>>>>>>> backend
    });
  }

  /**
<<<<<<< HEAD
   * Determines if an error is retryable
   */
  private isRetryableError(error: Error, config: RetryConfig): boolean {
    return config.retryableErrors.some(retryableError => 
      error.message.includes(retryableError) || error.name === retryableError
    );
  }

  /**
   * Calculates delay with exponential backoff and optional jitter
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    const exponentialDelay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, config.maxDelay);
    
    if (!config.jitter) {
      return cappedDelay;
    }

    // Add jitter (±25% of the delay)
    const jitterRange = cappedDelay * 0.25;
    const jitter = (Math.random() - 0.5) * 2 * jitterRange;
    return Math.max(0, cappedDelay + jitter);
=======
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
>>>>>>> backend
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
<<<<<<< HEAD
  private serviceName: string;
  private config: CircuitBreakerConfig;
  private state: CircuitBreakerState;
  private stats: CircuitBreakerStats;
  private logger: Logger;

  constructor(serviceName: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.serviceName = serviceName;
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
    this.state = CircuitBreakerState.CLOSED;
    this.stats = this.initializeStats();
    this.logger = Logger.createWithCorrelationId();
  }

  /**
   * Checks if the circuit breaker allows execution
   */
  async canExecute(): Promise<boolean> {
    this.updateStatsWindow();

    switch (this.state) {
      case CircuitBreakerState.CLOSED:
        return true;

      case CircuitBreakerState.OPEN:
        if (this.shouldAttemptRecovery()) {
          this.transitionToHalfOpen();
          return true;
        }
        return false;

      case CircuitBreakerState.HALF_OPEN:
        return true;

      default:
        return false;
=======
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
>>>>>>> backend
    }
  }

  /**
<<<<<<< HEAD
   * Records a successful operation
   */
  async recordSuccess(): Promise<void> {
    this.updateStatsWindow();
    this.stats.successfulRequests++;
    this.stats.totalRequests++;
    this.stats.lastSuccessTime = Date.now();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.transitionToClosed();
    }

    this.logger.info(
      `Circuit breaker recorded success for ${this.serviceName}`,
      { state: this.state, stats: this.stats },
      LogCategory.NETWORK
    );
  }

  /**
   * Records a failed operation
   */
  async recordFailure(): Promise<void> {
    this.updateStatsWindow();
    this.stats.failedRequests++;
    this.stats.totalRequests++;
    this.stats.lastFailureTime = Date.now();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.transitionToOpen();
    } else if (this.state === CircuitBreakerState.CLOSED && this.shouldOpenCircuit()) {
      this.transitionToOpen();
    }

    this.logger.warn(
      `Circuit breaker recorded failure for ${this.serviceName}`,
      { state: this.state, stats: this.stats },
      LogCategory.NETWORK
    );
  }

  /**
   * Gets current circuit breaker state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Gets current statistics
   */
  getStats(): CircuitBreakerStats {
    this.updateStatsWindow();
    return { ...this.stats };
  }

  /**
   * Initializes statistics
   */
  private initializeStats(): CircuitBreakerStats {
    const now = Date.now();
    return {
      totalRequests: 0,
      failedRequests: 0,
      successfulRequests: 0,
      lastFailureTime: 0,
      lastSuccessTime: 0,
      windowStart: now
=======
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
>>>>>>> backend
    };
  }

  /**
<<<<<<< HEAD
   * Updates the statistics window
   */
  private updateStatsWindow(): void {
    const now = Date.now();
    if (now - this.stats.windowStart >= this.config.monitoringPeriod) {
      this.stats = this.initializeStats();
    }
  }

  /**
   * Determines if the circuit should open
   */
  private shouldOpenCircuit(): boolean {
    if (this.stats.totalRequests < this.config.minimumThroughput) {
      return false;
    }

    const failureRate = this.stats.failedRequests / this.stats.totalRequests;
    return failureRate >= this.config.failureThreshold;
  }

  /**
   * Determines if recovery should be attempted
   */
  private shouldAttemptRecovery(): boolean {
    const now = Date.now();
    return now - this.stats.lastFailureTime >= this.config.recoveryTimeout;
  }

  /**
   * Transitions to CLOSED state
   */
  private transitionToClosed(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.stats = this.initializeStats();
    
    this.logger.info(
      `Circuit breaker for ${this.serviceName} transitioned to CLOSED`,
      { state: this.state },
      LogCategory.NETWORK
    );
  }

  /**
   * Transitions to OPEN state
   */
  private transitionToOpen(): void {
    this.state = CircuitBreakerState.OPEN;
    
    this.logger.error(
      `Circuit breaker for ${this.serviceName} transitioned to OPEN`,
      undefined,
      { state: this.state, stats: this.stats },
      LogCategory.NETWORK
    );
  }

  /**
   * Transitions to HALF_OPEN state
   */
  private transitionToHalfOpen(): void {
    this.state = CircuitBreakerState.HALF_OPEN;
    
    this.logger.info(
      `Circuit breaker for ${this.serviceName} transitioned to HALF_OPEN`,
      { state: this.state },
      LogCategory.NETWORK
    );
=======
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
>>>>>>> backend
  }
}

/**
<<<<<<< HEAD
 * Network resilience manager combining retry and circuit breaker patterns
=======
 * Network resilience manager combining retry and circuit breaker
>>>>>>> backend
 */
export class NetworkResilienceManager {
  private retryManager: RetryManager;
  private circuitBreakers: Map<string, CircuitBreaker>;
  private logger: Logger;

<<<<<<< HEAD
  constructor() {
    this.retryManager = new RetryManager();
=======
  constructor(
    retryConfig?: Partial<RetryConfig>,
    circuitBreakerConfig?: Partial<CircuitBreakerConfig>
  ) {
    this.retryManager = new RetryManager(retryConfig);
>>>>>>> backend
    this.circuitBreakers = new Map();
    this.logger = Logger.createWithCorrelationId();
  }

  /**
<<<<<<< HEAD
   * Executes an operation with both retry logic and circuit breaker protection
=======
   * Executes operation with both retry logic and circuit breaker
>>>>>>> backend
   */
  async executeWithResilience<T>(
    operation: () => Promise<T>,
    serviceName: string,
<<<<<<< HEAD
    operationName: string,
    retryConfig?: Partial<RetryConfig>,
    circuitBreakerConfig?: Partial<CircuitBreakerConfig>,
    fallback?: () => Promise<T>
  ): Promise<RetryResult<T>> {
    const circuitBreaker = this.getCircuitBreaker(serviceName, circuitBreakerConfig);
    
    // Check if circuit breaker allows execution
    const canExecute = await circuitBreaker.canExecute();
    if (!canExecute) {
      this.logger.warn(
        `Circuit breaker is OPEN for ${serviceName}, blocking operation ${operationName}`,
        { serviceName, operationName },
        LogCategory.NETWORK
      );

      if (fallback) {
        try {
          const fallbackResult = await fallback();
          return {
            success: true,
            result: fallbackResult,
            attempts: [],
            totalTime: 0,
            circuitBreakerTripped: true,
            fallbackUsed: true
          };
        } catch (fallbackError) {
          return {
            success: false,
            error: fallbackError as Error,
            attempts: [],
            totalTime: 0,
            circuitBreakerTripped: true,
            fallbackUsed: true
          };
        }
      }

      return {
        success: false,
        error: new Error(`Circuit breaker is OPEN for ${serviceName}`),
        attempts: [],
        totalTime: 0,
        circuitBreakerTripped: true
      };
    }

    // Execute with retry logic
    const result = await this.retryManager.executeWithRetry(
      operation,
      `${serviceName}:${operationName}`,
      retryConfig
    );

    // Record circuit breaker stats
    if (result.success) {
      await circuitBreaker.recordSuccess();
    } else {
      await circuitBreaker.recordFailure();
      
      // Try fallback if available
      if (fallback) {
        try {
          const fallbackResult = await fallback();
          return {
            ...result,
            success: true,
            result: fallbackResult,
            circuitBreakerTripped: false,
            fallbackUsed: true
          };
        } catch (fallbackError) {
          return {
            ...result,
            error: fallbackError as Error,
            circuitBreakerTripped: false,
            fallbackUsed: true
          };
        }
      }
    }

    return {
      ...result,
      circuitBreakerTripped: false
    };
  }

  /**
   * Gets or creates a circuit breaker for a service
   */
  getCircuitBreaker(serviceName: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.circuitBreakers.has(serviceName)) {
      this.circuitBreakers.set(serviceName, new CircuitBreaker(serviceName, config));
    }
    return this.circuitBreakers.get(serviceName)!;
  }

  /**
   * Gets statistics for all circuit breakers
   */
  getAllCircuitBreakerStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    
    for (const [serviceName, circuitBreaker] of this.circuitBreakers) {
      stats[serviceName] = circuitBreaker.getStats();
    }
    
    return stats;
  }

  /**
   * Gets overall health status
   */
  getHealthStatus(): {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, 'healthy' | 'degraded'>;
  } {
    const services: Record<string, 'healthy' | 'degraded'> = {};
    let degradedCount = 0;

    for (const [serviceName, circuitBreaker] of this.circuitBreakers) {
      const state = circuitBreaker.getState();
      if (state === CircuitBreakerState.OPEN || state === CircuitBreakerState.HALF_OPEN) {
        services[serviceName] = 'degraded';
        degradedCount++;
      } else {
        services[serviceName] = 'healthy';
      }
    }

    const totalServices = this.circuitBreakers.size;
    let overall: 'healthy' | 'degraded' | 'unhealthy';

    if (degradedCount === 0) {
      overall = 'healthy';
    } else if (degradedCount < totalServices / 2) {
      overall = 'degraded';
    } else {
      overall = 'unhealthy';
    }

    return { overall, services };
  }
}

// Export singleton instances
export const retryManager = new RetryManager();
export const networkResilienceManager = new NetworkResilienceManager();
=======
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
>>>>>>> backend
