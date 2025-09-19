/**
 * Comprehensive metrics collection system for ChipiPay wallet operations
 * Provides real-time metrics, health checks, and performance monitoring
 */

import pool from './db';
import { Logger, LogCategory, WalletOperationType } from './logging';

// Metric types
export enum MetricType {
  COUNTER = 'COUNTER',
  GAUGE = 'GAUGE',
  HISTOGRAM = 'HISTOGRAM',
  TIMER = 'TIMER'
}

// Metric categories
export enum MetricCategory {
  WALLET_OPERATIONS = 'WALLET_OPERATIONS',
  API_PERFORMANCE = 'API_PERFORMANCE',
  CHIPIPAY_API = 'CHIPIPAY_API',
  AUTHENTICATION = 'AUTHENTICATION',
  SYSTEM_HEALTH = 'SYSTEM_HEALTH',
  ERROR_RATES = 'ERROR_RATES'
}

// Health check status
export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  UNHEALTHY = 'UNHEALTHY'
}

// Metric data structure
interface MetricData {
  name: string;
  type: MetricType;
  category: MetricCategory;
  value: number;
  timestamp: Date;
  labels?: Record<string, string>;
  metadata?: Record<string, any>;
}

// Health check result
interface HealthCheckResult {
  service: string;
  status: HealthStatus;
  responseTime?: number;
  error?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Aggregated metrics for dashboards
interface AggregatedMetrics {
  walletCreationSuccessRate: number;
  transactionSuccessRates: Record<WalletOperationType, number>;
  averageApiResponseTime: number;
  errorRatesByCategory: Record<string, number>;
  chipipayApiHealth: HealthStatus;
  totalWalletOperations: number;
  activeUsers: number;
}

// Time series data point
interface TimeSeriesDataPoint {
  timestamp: Date;
  value: number;
  labels?: Record<string, string>;
}

export class MetricsCollector {
  private static instance: MetricsCollector;
  private logger: Logger;
  private metricsBuffer: MetricData[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly BUFFER_SIZE = 100;
  private readonly FLUSH_INTERVAL_MS = 30000; // 30 seconds

  private constructor() {
    this.logger = Logger.createWithCorrelationId();
    this.startPeriodicFlush();
  }

  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  /**
   * Record a counter metric (incrementing value)
   */
  public incrementCounter(
    name: string,
    category: MetricCategory,
    value: number = 1,
    labels?: Record<string, string>,
    metadata?: Record<string, any>
  ): void {
    this.recordMetric({
      name,
      type: MetricType.COUNTER,
      category,
      value,
      timestamp: new Date(),
      labels,
      metadata
    });
  }

  /**
   * Record a gauge metric (current value)
   */
  public recordGauge(
    name: string,
    category: MetricCategory,
    value: number,
    labels?: Record<string, string>,
    metadata?: Record<string, any>
  ): void {
    this.recordMetric({
      name,
      type: MetricType.GAUGE,
      category,
      value,
      timestamp: new Date(),
      labels,
      metadata
    });
  }

  /**
   * Record a histogram metric (distribution of values)
   */
  public recordHistogram(
    name: string,
    category: MetricCategory,
    value: number,
    labels?: Record<string, string>,
    metadata?: Record<string, any>
  ): void {
    this.recordMetric({
      name,
      type: MetricType.HISTOGRAM,
      category,
      value,
      timestamp: new Date(),
      labels,
      metadata
    });
  }

  /**
   * Record a timer metric (duration measurement)
   */
  public recordTimer(
    name: string,
    category: MetricCategory,
    durationMs: number,
    labels?: Record<string, string>,
    metadata?: Record<string, any>
  ): void {
    this.recordMetric({
      name,
      type: MetricType.TIMER,
      category,
      value: durationMs,
      timestamp: new Date(),
      labels,
      metadata
    });
  }

  /**
   * Create a timer that can be stopped to record duration
   */
  public startTimer(
    name: string,
    category: MetricCategory,
    labels?: Record<string, string>,
    metadata?: Record<string, any>
  ): () => void {
    const startTime = Date.now();
    
    return () => {
      const duration = Date.now() - startTime;
      this.recordTimer(name, category, duration, labels, metadata);
    };
  }

  /**
   * Record wallet operation metrics
   */
  public recordWalletOperation(
    operationType: WalletOperationType,
    success: boolean,
    durationMs: number,
    merchantId?: string,
    environment?: 'testnet' | 'mainnet'
  ): void {
    const labels = {
      operation_type: operationType,
      success: success.toString(),
      environment: environment || 'unknown'
    };

    // Record operation count
    this.incrementCounter('wallet_operations_total', MetricCategory.WALLET_OPERATIONS, 1, labels, {
      merchantId
    });

    // Record operation duration
    this.recordTimer('wallet_operation_duration_ms', MetricCategory.WALLET_OPERATIONS, durationMs, labels, {
      merchantId
    });

    // Record success/failure
    if (success) {
      this.incrementCounter('wallet_operations_success_total', MetricCategory.WALLET_OPERATIONS, 1, labels, {
        merchantId
      });
    } else {
      this.incrementCounter('wallet_operations_failure_total', MetricCategory.WALLET_OPERATIONS, 1, labels, {
        merchantId
      });
    }
  }

  /**
   * Record API request metrics
   */
  public recordApiRequest(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    merchantId?: string
  ): void {
    const labels = {
      method,
      path,
      status_code: statusCode.toString(),
      status_class: `${Math.floor(statusCode / 100)}xx`
    };

    // Record request count
    this.incrementCounter('api_requests_total', MetricCategory.API_PERFORMANCE, 1, labels, {
      merchantId
    });

    // Record request duration
    this.recordTimer('api_request_duration_ms', MetricCategory.API_PERFORMANCE, durationMs, labels, {
      merchantId
    });

    // Record error rates
    if (statusCode >= 400) {
      this.incrementCounter('api_errors_total', MetricCategory.ERROR_RATES, 1, labels, {
        merchantId
      });
    }
  }

  /**
   * Record ChipiPay API health metrics
   */
  public recordChipiPayApiHealth(
    endpoint: string,
    success: boolean,
    responseTimeMs: number,
    error?: string
  ): void {
    const labels = {
      endpoint,
      success: success.toString()
    };

    // Record API call
    this.incrementCounter('chipipay_api_calls_total', MetricCategory.CHIPIPAY_API, 1, labels);

    // Record response time
    this.recordTimer('chipipay_api_response_time_ms', MetricCategory.CHIPIPAY_API, responseTimeMs, labels);

    // Record errors
    if (!success) {
      this.incrementCounter('chipipay_api_errors_total', MetricCategory.CHIPIPAY_API, 1, labels, {
        error
      });
    }
  }

  /**
   * Record authentication metrics
   */
  public recordAuthentication(
    type: 'api_key' | 'pin' | 'jwt',
    success: boolean,
    merchantId?: string
  ): void {
    const labels = {
      auth_type: type,
      success: success.toString()
    };

    this.incrementCounter('authentication_attempts_total', MetricCategory.AUTHENTICATION, 1, labels, {
      merchantId
    });

    if (!success) {
      this.incrementCounter('authentication_failures_total', MetricCategory.AUTHENTICATION, 1, labels, {
        merchantId
      });
    }
  }

  /**
   * Record system health metrics
   */
  public recordSystemHealth(
    component: string,
    status: HealthStatus,
    responseTime?: number,
    metadata?: Record<string, any>
  ): void {
    const labels = {
      component,
      status
    };

    this.recordGauge('system_health_status', MetricCategory.SYSTEM_HEALTH, 
      status === HealthStatus.HEALTHY ? 1 : status === HealthStatus.DEGRADED ? 0.5 : 0,
      labels, metadata
    );

    if (responseTime !== undefined) {
      this.recordTimer('system_health_response_time_ms', MetricCategory.SYSTEM_HEALTH, responseTime, labels);
    }
  }

  /**
   * Get aggregated metrics for dashboards
   */
  public async getAggregatedMetrics(timeRangeHours: number = 24): Promise<AggregatedMetrics> {
    const client = await pool.connect();
    try {
      const since = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);

      // Get wallet creation success rate
      const walletCreationResult = await client.query(`
        SELECT 
          COUNT(*) FILTER (WHERE labels->>'success' = 'true') as success_count,
          COUNT(*) as total_count
        FROM metrics 
        WHERE name = 'wallet_operations_total' 
          AND labels->>'operation_type' = 'WALLET_CREATION'
          AND timestamp >= $1
      `, [since]);

      const walletCreationData = walletCreationResult.rows[0];
      const walletCreationSuccessRate = walletCreationData.total_count > 0 
        ? (walletCreationData.success_count / walletCreationData.total_count) * 100 
        : 0;

      // Get transaction success rates by operation type
      const transactionRatesResult = await client.query(`
        SELECT 
          labels->>'operation_type' as operation_type,
          COUNT(*) FILTER (WHERE labels->>'success' = 'true') as success_count,
          COUNT(*) as total_count
        FROM metrics 
        WHERE name = 'wallet_operations_total' 
          AND timestamp >= $1
        GROUP BY labels->>'operation_type'
      `, [since]);

      const transactionSuccessRates: Record<WalletOperationType, number> = {} as any;
      transactionRatesResult.rows.forEach(row => {
        const rate = row.total_count > 0 ? (row.success_count / row.total_count) * 100 : 0;
        transactionSuccessRates[row.operation_type as WalletOperationType] = rate;
      });

      // Get average API response time
      const apiResponseTimeResult = await client.query(`
        SELECT AVG(value) as avg_response_time
        FROM metrics 
        WHERE name = 'api_request_duration_ms' 
          AND timestamp >= $1
      `, [since]);

      const averageApiResponseTime = parseFloat(apiResponseTimeResult.rows[0]?.avg_response_time || '0');

      // Get error rates by category
      const errorRatesResult = await client.query(`
        SELECT 
          category,
          COUNT(*) as error_count
        FROM metrics 
        WHERE name LIKE '%_errors_total' 
          AND timestamp >= $1
        GROUP BY category
      `, [since]);

      const errorRatesByCategory: Record<string, number> = {};
      errorRatesResult.rows.forEach(row => {
        errorRatesByCategory[row.category] = parseInt(row.error_count);
      });

      // Get ChipiPay API health
      const chipipayHealthResult = await client.query(`
        SELECT 
          COUNT(*) FILTER (WHERE labels->>'success' = 'true') as success_count,
          COUNT(*) as total_count
        FROM metrics 
        WHERE name = 'chipipay_api_calls_total' 
          AND timestamp >= $1
      `, [since]);

      const chipipayHealthData = chipipayHealthResult.rows[0];
      const chipipaySuccessRate = chipipayHealthData.total_count > 0 
        ? (chipipayHealthData.success_count / chipipayHealthData.total_count) * 100 
        : 100;

      const chipipayApiHealth = chipipaySuccessRate >= 95 
        ? HealthStatus.HEALTHY 
        : chipipaySuccessRate >= 80 
          ? HealthStatus.DEGRADED 
          : HealthStatus.UNHEALTHY;

      // Get total wallet operations
      const totalOperationsResult = await client.query(`
        SELECT SUM(value) as total_operations
        FROM metrics 
        WHERE name = 'wallet_operations_total' 
          AND timestamp >= $1
      `, [since]);

      const totalWalletOperations = parseInt(totalOperationsResult.rows[0]?.total_operations || '0');

      // Get active users (merchants with operations in time range)
      const activeUsersResult = await client.query(`
        SELECT COUNT(DISTINCT metadata->>'merchantId') as active_users
        FROM metrics 
        WHERE name = 'wallet_operations_total' 
          AND timestamp >= $1
          AND metadata->>'merchantId' IS NOT NULL
      `, [since]);

      const activeUsers = parseInt(activeUsersResult.rows[0]?.active_users || '0');

      return {
        walletCreationSuccessRate,
        transactionSuccessRates,
        averageApiResponseTime,
        errorRatesByCategory,
        chipipayApiHealth,
        totalWalletOperations,
        activeUsers
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get time series data for a specific metric
   */
  public async getTimeSeriesData(
    metricName: string,
    timeRangeHours: number = 24,
    intervalMinutes: number = 60,
    labels?: Record<string, string>
  ): Promise<TimeSeriesDataPoint[]> {
    const client = await pool.connect();
    try {
      const since = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);
      const intervalMs = intervalMinutes * 60 * 1000;

      let query = `
        SELECT 
          date_trunc('hour', timestamp) as time_bucket,
          AVG(value) as avg_value,
          labels
        FROM metrics 
        WHERE name = $1 
          AND timestamp >= $2
      `;
      const params: any[] = [metricName, since];

      if (labels) {
        Object.entries(labels).forEach(([key, value], index) => {
          query += ` AND labels->>'${key}' = $${params.length + 1}`;
          params.push(value);
        });
      }

      query += `
        GROUP BY date_trunc('hour', timestamp), labels
        ORDER BY time_bucket ASC
      `;

      const result = await client.query(query, params);
      
      return result.rows.map(row => ({
        timestamp: new Date(row.time_bucket),
        value: parseFloat(row.avg_value),
        labels: row.labels
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Private method to record metric
   */
  private recordMetric(metric: MetricData): void {
    this.metricsBuffer.push(metric);

    // Flush if buffer is full
    if (this.metricsBuffer.length >= this.BUFFER_SIZE) {
      this.flushMetrics();
    }
  }

  /**
   * Flush metrics buffer to database
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) {
      return;
    }

    const metricsToFlush = [...this.metricsBuffer];
    this.metricsBuffer = [];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const metric of metricsToFlush) {
        await client.query(`
          INSERT INTO metrics (name, type, category, value, timestamp, labels, metadata)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          metric.name,
          metric.type,
          metric.category,
          metric.value,
          metric.timestamp,
          metric.labels ? JSON.stringify(metric.labels) : null,
          metric.metadata ? JSON.stringify(metric.metadata) : null
        ]);
      }

      await client.query('COMMIT');

      this.logger.debug(`Flushed ${metricsToFlush.length} metrics to database`, {
        metricsCount: metricsToFlush.length
      }, LogCategory.SYSTEM);
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Failed to flush metrics to database', error, {
        metricsCount: metricsToFlush.length
      }, LogCategory.SYSTEM);

      // Put metrics back in buffer for retry
      this.metricsBuffer.unshift(...metricsToFlush);
    } finally {
      client.release();
    }
  }

  /**
   * Start periodic flush of metrics
   */
  private startPeriodicFlush(): void {
    this.flushInterval = setInterval(() => {
      this.flushMetrics().catch(error => {
        this.logger.error('Periodic metrics flush failed', error, {}, LogCategory.SYSTEM);
      });
    }, this.FLUSH_INTERVAL_MS);
  }

  /**
   * Stop metrics collection and flush remaining metrics
   */
  public async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    await this.flushMetrics();
    this.logger.info('Metrics collector shutdown complete', {}, LogCategory.SYSTEM);
  }
}

// Export singleton instance
export const metricsCollector = MetricsCollector.getInstance();