/**
 * ChipiPay-specific network resilience wrapper
 * Provides retry logic and circuit breaker for ChipiPay API calls
 */

import { NetworkResilienceManager, RetryConfig, CircuitBreakerConfig } from './retry-logic';
import { Logger, LogCategory } from './logging';
import { ErrorCode } from './error-handling';

// ChipiPay specific retry configuration
const CHIPIPAY_RETRY_CONFIG: Partial<RetryConfig> = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitterMs: 200,
  retryableErrors: [
    'NETWORK_ERROR',
    'TIMEOUT_ERROR',
    'CONNECTION_FAILED',
    'CHIPIPAY_SERVICE_UNAVAILABLE',
    'ECONNRESET',
    'ENOTFOUND',
    'ETIMEDOUT',
    'ECONNREFUSED'
  ],
  timeoutMs: 30000
};

// ChipiPay specific circuit breaker configuration
const CHIPIPAY_CIRCUIT_BREAKER_CONFIG: Partial<CircuitBreakerConfig> = {
  failureThreshold: 50, // 50% failure rate
  recoveryTimeoutMs: 30000, // 30 seconds
  monitoringWindowMs: 60000, // 1 minute window
  minimumThroughput: 5 // Minimum 5 requests before opening circuit
};

/**
 * ChipiPay resilience manager
 */
export class ChipiPayResilienceManager {
  private resilienceManager: NetworkResilienceManager;
  private logger: Logger;

  constructor() {
    this.resilienceManager = new NetworkResilienceManager(
      CHIPIPAY_RETRY_CONFIG,
      CHIPIPAY_CIRCUIT_BREAKER_CONFIG
    );
    this.logger = Logger.createWithCorrelationId();
  }

  /**
   * Executes ChipiPay API call with resilience
   */
  async executeChipiPayCall<T>(
    operation: () => Promise<T>,
    operationType: string,
    merchantId?: string,
    environment?: 'testnet' | 'mainnet'
  ): Promise<T> {
    const serviceName = `chipipay-${environment || 'unknown'}`;
    const context = `ChipiPay ${operationType}`;

    this.logger.info(`Executing ${context} with resilience`, {
      operationType,
      merchantId,
      environment,
      serviceName
    }, LogCategory.CHIPIPAY);

    try {
      const result = await this.resilienceManager.executeWithResilience(
        operation,
        serviceName,
        context,
        {
          retryConfig: CHIPIPAY_RETRY_CONFIG,
          circuitBreakerConfig: CHIPIPAY_CIRCUIT_BREAKER_CONFIG
        }
      );

      this.logger.info(`${context} completed successfully`, {
        operationType,
        merchantId,
        environment
      }, LogCategory.CHIPIPAY);

      return result;
    } catch (error) {
      this.logger.error(`${context} failed after resilience attempts`, error as Error, {
        operationType,
        merchantId,
        environment,
        serviceName
      }, LogCategory.CHIPIPAY);

      // Map common errors to appropriate error codes
      const mappedError = this.mapChipiPayError(error as Error, operationType);
      throw mappedError;
    }
  }

  /**
   * Executes wallet creation with specific resilience settings
   */
  async executeWalletCreation<T>(
    operation: () => Promise<T>,
    merchantId: string,
    environment: 'testnet' | 'mainnet'
  ): Promise<T> {
    // Wallet creation is critical, use more aggressive retry
    const walletCreationConfig: Partial<RetryConfig> = {
      ...CHIPIPAY_RETRY_CONFIG,
      maxAttempts: 5,
      baseDelayMs: 2000,
      maxDelayMs: 15000
    };

    const serviceName = `chipipay-wallet-creation-${environment}`;
    const context = 'ChipiPay Wallet Creation';

    this.logger.info(`Executing ${context} with enhanced resilience`, {
      merchantId,
      environment,
      maxAttempts: walletCreationConfig.maxAttempts
    }, LogCategory.CHIPIPAY);

    try {
      return await this.resilienceManager.executeWithResilience(
        operation,
        serviceName,
        context,
        {
          retryConfig: walletCreationConfig,
          circuitBreakerConfig: CHIPIPAY_CIRCUIT_BREAKER_CONFIG
        }
      );
    } catch (error) {
      this.logger.error(`${context} failed after enhanced resilience attempts`, error as Error, {
        merchantId,
        environment
      }, LogCategory.CHIPIPAY);

      throw this.mapChipiPayError(error as Error, 'wallet-creation');
    }
  }

  /**
   * Executes transaction operations with specific resilience settings
   */
  async executeTransaction<T>(
    operation: () => Promise<T>,
    operationType: 'transfer' | 'approve' | 'stake' | 'withdraw' | 'contract-call',
    merchantId: string,
    environment: 'testnet' | 'mainnet',
    txDetails?: {
      amount?: string;
      recipient?: string;
      contractAddress?: string;
    }
  ): Promise<T> {
    // Transaction operations need balanced resilience
    const transactionConfig: Partial<RetryConfig> = {
      ...CHIPIPAY_RETRY_CONFIG,
      maxAttempts: 4,
      baseDelayMs: 1500,
      timeoutMs: 45000 // Longer timeout for transactions
    };

    const serviceName = `chipipay-transaction-${environment}`;
    const context = `ChipiPay ${operationType} Transaction`;

    this.logger.info(`Executing ${context} with resilience`, {
      operationType,
      merchantId,
      environment,
      txDetails
    }, LogCategory.CHIPIPAY);

    try {
      return await this.resilienceManager.executeWithResilience(
        operation,
        serviceName,
        context,
        {
          retryConfig: transactionConfig,
          circuitBreakerConfig: CHIPIPAY_CIRCUIT_BREAKER_CONFIG
        }
      );
    } catch (error) {
      this.logger.error(`${context} failed after resilience attempts`, error as Error, {
        operationType,
        merchantId,
        environment,
        txDetails
      }, LogCategory.CHIPIPAY);

      throw this.mapChipiPayError(error as Error, operationType);
    }
  }

  /**
   * Executes authentication operations with specific resilience settings
   */
  async executeAuthentication<T>(
    operation: () => Promise<T>,
    merchantId: string,
    environment: 'testnet' | 'mainnet'
  ): Promise<T> {
    // Authentication should be fast and not retry too much
    const authConfig: Partial<RetryConfig> = {
      ...CHIPIPAY_RETRY_CONFIG,
      maxAttempts: 2,
      baseDelayMs: 500,
      maxDelayMs: 2000,
      timeoutMs: 10000
    };

    const serviceName = `chipipay-auth-${environment}`;
    const context = 'ChipiPay Authentication';

    this.logger.info(`Executing ${context} with resilience`, {
      merchantId,
      environment
    }, LogCategory.CHIPIPAY);

    try {
      return await this.resilienceManager.executeWithResilience(
        operation,
        serviceName,
        context,
        {
          retryConfig: authConfig,
          circuitBreakerConfig: CHIPIPAY_CIRCUIT_BREAKER_CONFIG
        }
      );
    } catch (error) {
      this.logger.error(`${context} failed after resilience attempts`, error as Error, {
        merchantId,
        environment
      }, LogCategory.CHIPIPAY);

      throw this.mapChipiPayError(error as Error, 'authentication');
    }
  }

  /**
   * Maps ChipiPay errors to appropriate error codes
   */
  private mapChipiPayError(error: Error, operationType: string): Error {
    const errorMessage = error.message.toLowerCase();
    
    // Create new error with appropriate code
    const mappedError = new Error(error.message);
    mappedError.stack = error.stack;
    mappedError.name = error.name;

    // Add error code based on error type
    if (errorMessage.includes('timeout') || errorMessage.includes('etimedout')) {
      (mappedError as any).code = ErrorCode.TIMEOUT_ERROR;
    } else if (errorMessage.includes('network') || errorMessage.includes('econnreset') || 
               errorMessage.includes('enotfound') || errorMessage.includes('econnrefused')) {
      (mappedError as any).code = ErrorCode.NETWORK_ERROR;
    } else if (errorMessage.includes('circuit breaker') || errorMessage.includes('service unavailable')) {
      (mappedError as any).code = ErrorCode.CHIPIPAY_SERVICE_UNAVAILABLE;
    } else if (errorMessage.includes('authentication') || errorMessage.includes('unauthorized')) {
      (mappedError as any).code = ErrorCode.CHIPIPAY_AUTHENTICATION_FAILED;
    } else if (operationType === 'wallet-creation') {
      (mappedError as any).code = ErrorCode.WALLET_CREATION_FAILED;
    } else if (operationType.includes('transfer')) {
      (mappedError as any).code = ErrorCode.TRANSFER_FAILED;
    } else if (operationType.includes('approve')) {
      (mappedError as any).code = ErrorCode.APPROVAL_FAILED;
    } else if (operationType.includes('contract')) {
      (mappedError as any).code = ErrorCode.CONTRACT_CALL_FAILED;
    } else {
      (mappedError as any).code = ErrorCode.CHIPIPAY_API_ERROR;
    }

    return mappedError;
  }

  /**
   * Gets ChipiPay service health status
   */
  getServiceHealth(): {
    services: Array<{
      name: string;
      state: string;
      failureRate: number;
      isHealthy: boolean;
    }>;
    overallHealth: 'healthy' | 'degraded' | 'unhealthy';
  } {
    const statuses = this.resilienceManager.getCircuitBreakerStatuses();
    const chipipayServices = statuses.filter(status => status.name.startsWith('chipipay-'));

    const services = chipipayServices.map(status => ({
      name: status.name,
      state: status.state,
      failureRate: status.failureRate,
      isHealthy: status.state === 'CLOSED' && status.failureRate < 25
    }));

    // Determine overall health
    let overallHealth: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    const unhealthyServices = services.filter(s => !s.isHealthy);
    if (unhealthyServices.length > 0) {
      if (unhealthyServices.length === services.length) {
        overallHealth = 'unhealthy';
      } else {
        overallHealth = 'degraded';
      }
    }

    return {
      services,
      overallHealth
    };
  }

  /**
   * Resets ChipiPay circuit breakers
   */
  resetChipiPayCircuitBreakers(): void {
    const statuses = this.resilienceManager.getCircuitBreakerStatuses();
    const chipipayServices = statuses.filter(status => status.name.startsWith('chipipay-'));

    chipipayServices.forEach(status => {
      this.resilienceManager.resetCircuitBreaker(status.name);
    });

    this.logger.info('ChipiPay circuit breakers reset', {
      resetCount: chipipayServices.length,
      services: chipipayServices.map(s => s.name)
    }, LogCategory.CHIPIPAY);
  }

  /**
   * Gets detailed metrics for monitoring
   */
  getMetrics(): {
    circuitBreakers: Array<{
      name: string;
      state: string;
      metrics: any;
      failureRate: number;
    }>;
    timestamp: string;
  } {
    const statuses = this.resilienceManager.getCircuitBreakerStatuses();
    const chipipayServices = statuses.filter(status => status.name.startsWith('chipipay-'));

    return {
      circuitBreakers: chipipayServices,
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const chipipayResilience = new ChipiPayResilienceManager();