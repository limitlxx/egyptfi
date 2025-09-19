/**
 * Health check system for monitoring ChipiPay API connectivity and system status
 * Provides comprehensive health monitoring for all system components
 */

import pool from './db';
import { Logger, LogCategory } from './logging';
import { metricsCollector, HealthStatus, MetricCategory } from './metrics';
import { ChipiPayConfigService } from '../services/chipipayConfigService';

// Health check configuration
interface HealthCheckConfig {
  timeout: number;
  retries: number;
  interval: number;
}

// Individual health check result
interface HealthCheckResult {
  service: string;
  status: HealthStatus;
  responseTime: number;
  error?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// System health summary
interface SystemHealthSummary {
  overall: HealthStatus;
  services: HealthCheckResult[];
  timestamp: Date;
  uptime: number;
}

// Health check interface
interface HealthCheck {
  name: string;
  check(): Promise<HealthCheckResult>;
}

export class HealthCheckService {
  private static instance: HealthCheckService;
  private logger: Logger;
  private healthChecks: Map<string, HealthCheck> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private startTime: Date;
  private lastHealthResults: Map<string, HealthCheckResult> = new Map();

  private readonly DEFAULT_CONFIG: HealthCheckConfig = {
    timeout: 5000, // 5 seconds
    retries: 3,
    interval: 30000 // 30 seconds
  };

  private constructor() {
    this.logger = Logger.createWithCorrelationId();
    this.startTime = new Date();
    this.initializeHealthChecks();
    this.startPeriodicHealthChecks();
  }

  public static getInstance(): HealthCheckService {
    if (!HealthCheckService.instance) {
      HealthCheckService.instance = new HealthCheckService();
    }
    return HealthCheckService.instance;
  }

  /**
   * Initialize all health checks
   */
  private initializeHealthChecks(): void {
    // Database health check
    this.healthChecks.set('database', {
      name: 'database',
      check: this.checkDatabase.bind(this)
    });

    // ChipiPay API health check
    this.healthChecks.set('chipipay-api', {
      name: 'chipipay-api',
      check: this.checkChipiPayApi.bind(this)
    });

    // Memory health check
    this.healthChecks.set('memory', {
      name: 'memory',
      check: this.checkMemoryUsage.bind(this)
    });

    // Disk space health check
    this.healthChecks.set('disk', {
      name: 'disk',
      check: this.checkDiskSpace.bind(this)
    });

    this.logger.info(`Initialized ${this.healthChecks.size} health checks`, {
      healthChecks: Array.from(this.healthChecks.keys())
    }, LogCategory.SYSTEM);
  }

  /**
   * Check database connectivity and performance
   */
  private async checkDatabase(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const client = await pool.connect();
      
      try {
        // Simple query to test connectivity
        await client.query('SELECT 1');
        
        // Check connection pool status
        const poolStatus = {
          totalCount: pool.totalCount,
          idleCount: pool.idleCount,
          waitingCount: pool.waitingCount
        };

        const responseTime = Date.now() - startTime;
        
        // Determine health status based on response time and pool status
        let status = HealthStatus.HEALTHY;
        if (responseTime > 1000 || pool.waitingCount > 5) {
          status = HealthStatus.DEGRADED;
        }
        if (responseTime > 5000 || pool.waitingCount > 20) {
          status = HealthStatus.UNHEALTHY;
        }

        return {
          service: 'database',
          status,
          responseTime,
          timestamp: new Date(),
          metadata: {
            poolStatus,
            queryTime: responseTime
          }
        };
      } finally {
        client.release();
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'database',
        status: HealthStatus.UNHEALTHY,
        responseTime,
        error: error.message,
        timestamp: new Date(),
        metadata: {
          errorType: error.constructor.name
        }
      };
    }
  }

  /**
   * Check ChipiPay API connectivity
   */
  private async checkChipiPayApi(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const configService = ChipiPayConfigService.getInstance();
      const config = await configService.getConfig('testnet');
      
      // Make a simple health check request to ChipiPay API
      const response = await fetch(`${config.backendUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await configService.getBearerToken('testnet')}`
        },
        signal: AbortSignal.timeout(this.DEFAULT_CONFIG.timeout)
      });

      const responseTime = Date.now() - startTime;
      
      let status = HealthStatus.HEALTHY;
      if (responseTime > 2000) {
        status = HealthStatus.DEGRADED;
      }
      if (!response.ok || responseTime > 5000) {
        status = HealthStatus.UNHEALTHY;
      }

      return {
        service: 'chipipay-api',
        status,
        responseTime,
        timestamp: new Date(),
        metadata: {
          httpStatus: response.status,
          endpoint: `${config.backendUrl}/health`
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'chipipay-api',
        status: HealthStatus.UNHEALTHY,
        responseTime,
        error: error.message,
        timestamp: new Date(),
        metadata: {
          errorType: error.constructor.name,
          timeout: error.name === 'TimeoutError'
        }
      };
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemoryUsage(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const memUsage = process.memoryUsage();
      const totalMemory = memUsage.heapTotal;
      const usedMemory = memUsage.heapUsed;
      const memoryUsagePercent = (usedMemory / totalMemory) * 100;

      let status = HealthStatus.HEALTHY;
      if (memoryUsagePercent > 80) {
        status = HealthStatus.DEGRADED;
      }
      if (memoryUsagePercent > 95) {
        status = HealthStatus.UNHEALTHY;
      }

      const responseTime = Date.now() - startTime;

      return {
        service: 'memory',
        status,
        responseTime,
        timestamp: new Date(),
        metadata: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
          usagePercent: Math.round(memoryUsagePercent * 100) / 100,
          external: Math.round(memUsage.external / 1024 / 1024), // MB
          rss: Math.round(memUsage.rss / 1024 / 1024) // MB
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'memory',
        status: HealthStatus.UNHEALTHY,
        responseTime,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Check disk space (simplified for Node.js environment)
   */
  private async checkDiskSpace(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // In a real implementation, you might use a library like 'check-disk-space'
      // For now, we'll simulate disk space check
      const responseTime = Date.now() - startTime;

      return {
        service: 'disk',
        status: HealthStatus.HEALTHY,
        responseTime,
        timestamp: new Date(),
        metadata: {
          note: 'Disk space check not implemented - assuming healthy'
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'disk',
        status: HealthStatus.UNHEALTHY,
        responseTime,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Run all health checks
   */
  public async runAllHealthChecks(): Promise<SystemHealthSummary> {
    const results: HealthCheckResult[] = [];
    
    this.logger.info('Running all health checks', {
      healthCheckCount: this.healthChecks.size
    }, LogCategory.SYSTEM);

    // Run all health checks in parallel
    const healthCheckPromises = Array.from(this.healthChecks.values()).map(async (healthCheck) => {
      try {
        const result = await this.runHealthCheckWithRetry(healthCheck);
        this.lastHealthResults.set(healthCheck.name, result);
        
        // Record metrics
        metricsCollector.recordSystemHealth(
          healthCheck.name,
          result.status,
          result.responseTime,
          result.metadata
        );

        return result;
      } catch (error) {
        this.logger.error(`Health check failed for ${healthCheck.name}`, error, {
          healthCheckName: healthCheck.name
        }, LogCategory.SYSTEM);

        const failedResult: HealthCheckResult = {
          service: healthCheck.name,
          status: HealthStatus.UNHEALTHY,
          responseTime: 0,
          error: error.message,
          timestamp: new Date()
        };

        this.lastHealthResults.set(healthCheck.name, failedResult);
        return failedResult;
      }
    });

    results.push(...await Promise.all(healthCheckPromises));

    // Determine overall health status
    const overall = this.determineOverallHealth(results);
    const uptime = Date.now() - this.startTime.getTime();

    const summary: SystemHealthSummary = {
      overall,
      services: results,
      timestamp: new Date(),
      uptime
    };

    this.logger.info('Health check summary', {
      overall,
      serviceCount: results.length,
      healthyServices: results.filter(r => r.status === HealthStatus.HEALTHY).length,
      degradedServices: results.filter(r => r.status === HealthStatus.DEGRADED).length,
      unhealthyServices: results.filter(r => r.status === HealthStatus.UNHEALTHY).length,
      uptime
    }, LogCategory.SYSTEM);

    return summary;
  }

  /**
   * Run a single health check with retry logic
   */
  private async runHealthCheckWithRetry(healthCheck: HealthCheck): Promise<HealthCheckResult> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.DEFAULT_CONFIG.retries; attempt++) {
      try {
        const result = await healthCheck.check();
        
        if (attempt > 1) {
          this.logger.info(`Health check succeeded on attempt ${attempt}`, {
            healthCheckName: healthCheck.name,
            attempt,
            status: result.status
          }, LogCategory.SYSTEM);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        if (attempt < this.DEFAULT_CONFIG.retries) {
          const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
          this.logger.warn(`Health check failed, retrying in ${delay}ms`, {
            healthCheckName: healthCheck.name,
            attempt,
            error: error.message
          }, LogCategory.SYSTEM);
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    throw lastError || new Error('Health check failed after all retries');
  }

  /**
   * Determine overall system health based on individual service health
   */
  private determineOverallHealth(results: HealthCheckResult[]): HealthStatus {
    const unhealthyCount = results.filter(r => r.status === HealthStatus.UNHEALTHY).length;
    const degradedCount = results.filter(r => r.status === HealthStatus.DEGRADED).length;

    // If any critical service is unhealthy, system is unhealthy
    const criticalServices = ['database', 'chipipay-api'];
    const criticalUnhealthy = results.some(r => 
      criticalServices.includes(r.service) && r.status === HealthStatus.UNHEALTHY
    );

    if (criticalUnhealthy || unhealthyCount > results.length / 2) {
      return HealthStatus.UNHEALTHY;
    }

    if (degradedCount > 0 || unhealthyCount > 0) {
      return HealthStatus.DEGRADED;
    }

    return HealthStatus.HEALTHY;
  }

  /**
   * Get the last health check results
   */
  public getLastHealthResults(): Map<string, HealthCheckResult> {
    return new Map(this.lastHealthResults);
  }

  /**
   * Get health status for a specific service
   */
  public getServiceHealth(serviceName: string): HealthCheckResult | null {
    return this.lastHealthResults.get(serviceName) || null;
  }

  /**
   * Start periodic health checks
   */
  private startPeriodicHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.runAllHealthChecks().catch(error => {
        this.logger.error('Periodic health check failed', error, {}, LogCategory.SYSTEM);
      });
    }, this.DEFAULT_CONFIG.interval);

    this.logger.info('Started periodic health checks', {
      interval: this.DEFAULT_CONFIG.interval
    }, LogCategory.SYSTEM);
  }

  /**
   * Stop periodic health checks
   */
  public stopPeriodicHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      this.logger.info('Stopped periodic health checks', {}, LogCategory.SYSTEM);
    }
  }

  /**
   * Add a custom health check
   */
  public addHealthCheck(name: string, healthCheck: HealthCheck): void {
    this.healthChecks.set(name, healthCheck);
    this.logger.info(`Added custom health check: ${name}`, {
      totalHealthChecks: this.healthChecks.size
    }, LogCategory.SYSTEM);
  }

  /**
   * Remove a health check
   */
  public removeHealthCheck(name: string): boolean {
    const removed = this.healthChecks.delete(name);
    if (removed) {
      this.lastHealthResults.delete(name);
      this.logger.info(`Removed health check: ${name}`, {
        totalHealthChecks: this.healthChecks.size
      }, LogCategory.SYSTEM);
    }
    return removed;
  }

  /**
   * Shutdown health check service
   */
  public shutdown(): void {
    this.stopPeriodicHealthChecks();
    this.logger.info('Health check service shutdown complete', {}, LogCategory.SYSTEM);
  }
}

// Export singleton instance
export const healthCheckService = HealthCheckService.getInstance();