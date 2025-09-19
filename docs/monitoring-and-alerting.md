# Monitoring and Alerting System

This document describes the comprehensive monitoring and alerting system implemented for the ChipiPay wallet integration.

## Overview

The monitoring system provides:
- Real-time metrics collection for wallet operations
- Health checks for system components
- Configurable alerting based on thresholds and conditions
- Interactive dashboards for system visualization
- Automated incident response capabilities

## Architecture

### Components

1. **Metrics Collector** (`lib/metrics.ts`)
   - Collects and aggregates system metrics
   - Supports counters, gauges, histograms, and timers
   - Buffers metrics for efficient database storage

2. **Health Check Service** (`lib/health-checks.ts`)
   - Monitors system component health
   - Provides real-time status updates
   - Supports custom health checks

3. **Alerting Service** (`lib/alerting.ts`)
   - Evaluates alert conditions
   - Manages alert rules and notifications
   - Supports multiple notification channels

4. **Dashboard Service** (`lib/dashboard.ts`)
   - Provides data for monitoring dashboards
   - Supports various widget types
   - Configurable dashboard layouts

## Metrics Collection

### Metric Types

- **Counter**: Incrementing values (e.g., request counts, error counts)
- **Gauge**: Current values (e.g., memory usage, active connections)
- **Histogram**: Distribution of values (e.g., response time distributions)
- **Timer**: Duration measurements (e.g., operation durations)

### Key Metrics

#### Wallet Operations
- `wallet_operations_total`: Total wallet operations by type and status
- `wallet_operations_success_total`: Successful wallet operations
- `wallet_operations_failure_total`: Failed wallet operations
- `wallet_operation_duration_ms`: Duration of wallet operations

#### API Performance
- `api_requests_total`: Total API requests by method, path, and status
- `api_request_duration_ms`: API request response times
- `api_errors_total`: API errors by status code

#### ChipiPay API Health
- `chipipay_api_calls_total`: ChipiPay API calls by endpoint and status
- `chipipay_api_response_time_ms`: ChipiPay API response times
- `chipipay_api_errors_total`: ChipiPay API errors

#### Authentication
- `authentication_attempts_total`: Authentication attempts by type
- `authentication_failures_total`: Failed authentication attempts

#### System Health
- `system_health_status`: Health status of system components
- `system_health_response_time_ms`: Health check response times

### Usage Examples

```typescript
import { metricsCollector, MetricCategory } from '../lib/metrics';
import { WalletOperationType } from '../lib/logging';

// Record a wallet operation
metricsCollector.recordWalletOperation(
  WalletOperationType.TRANSFER,
  true, // success
  1500, // duration in ms
  'merchant-123',
  'testnet'
);

// Record API request
metricsCollector.recordApiRequest(
  'POST',
  '/api/wallet/transfer',
  200,
  300,
  'merchant-123'
);

// Record custom metric
metricsCollector.incrementCounter(
  'custom_events_total',
  MetricCategory.SYSTEM_HEALTH,
  1,
  { event_type: 'user_signup' }
);
```

## Health Checks

### Built-in Health Checks

1. **Database Health**
   - Connection availability
   - Query response time
   - Connection pool status

2. **ChipiPay API Health**
   - API endpoint availability
   - Response time monitoring
   - Authentication status

3. **Memory Health**
   - Heap usage monitoring
   - Memory leak detection
   - Performance degradation alerts

4. **Disk Health**
   - Available disk space
   - I/O performance

### Health Status Levels

- **HEALTHY**: All systems operating normally
- **DEGRADED**: Some performance issues detected
- **UNHEALTHY**: Critical issues requiring attention

### Custom Health Checks

```typescript
import { healthCheckService } from '../lib/health-checks';

// Add custom health check
healthCheckService.addHealthCheck('external-service', {
  name: 'external-service',
  check: async () => {
    const startTime = Date.now();
    try {
      const response = await fetch('https://api.external-service.com/health');
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'external-service',
        status: response.ok ? 'HEALTHY' : 'UNHEALTHY',
        responseTime,
        timestamp: new Date(),
        metadata: { httpStatus: response.status }
      };
    } catch (error) {
      return {
        service: 'external-service',
        status: 'UNHEALTHY',
        responseTime: Date.now() - startTime,
        error: error.message,
        timestamp: new Date()
      };
    }
  }
});
```

## Alerting System

### Alert Rule Types

1. **Threshold Alerts**
   - Trigger when metric values exceed/fall below thresholds
   - Support various comparison operators (>, <, >=, <=, =, !=)

2. **Rate Alerts**
   - Monitor success/failure rates
   - Useful for error rate monitoring

3. **Absence Alerts**
   - Trigger when expected metrics are missing
   - Useful for heartbeat monitoring

### Alert Severity Levels

- **LOW**: Informational alerts
- **MEDIUM**: Warning conditions
- **HIGH**: Significant issues requiring attention
- **CRITICAL**: Urgent issues requiring immediate action

### Default Alert Rules

The system includes pre-configured alert rules:

1. **High Error Rate**: API error rate > 5%
2. **ChipiPay API Down**: ChipiPay API success rate < 80%
3. **High Response Time**: API response time > 5 seconds
4. **Database Issues**: Database health check failures
5. **Memory Usage High**: Memory usage > 90%
6. **Wallet Operation Failures**: Wallet failure rate > 10%

### Creating Custom Alert Rules

```typescript
import { alertingService, AlertSeverity, AlertConditionType, ComparisonOperator } from '../lib/alerting';

// Create threshold alert
const rule = await alertingService.createAlertRule({
  name: 'High Memory Usage',
  description: 'Alert when memory usage exceeds 85%',
  metricName: 'system_health_status',
  conditionType: AlertConditionType.THRESHOLD,
  thresholdValue: 0.15, // Below 15% (85% usage)
  comparisonOperator: ComparisonOperator.LESS_THAN,
  timeWindowMinutes: 5,
  severity: AlertSeverity.HIGH,
  enabled: true,
  labels: { component: 'memory' }
});
```

### Notification Channels

1. **Console**: Log alerts to console (always available)
2. **Webhook**: Send alerts to external webhook endpoints
3. **Email**: Send email notifications (configurable)
4. **Slack**: Send Slack notifications (configurable)

Configure webhook notifications via environment variables:
```bash
ALERT_WEBHOOK_URL=https://your-webhook-endpoint.com/alerts
```

## Dashboards

### Built-in Dashboards

1. **System Overview**
   - Overall system health
   - Key performance metrics
   - Recent alerts
   - Error rate summaries

2. **Wallet Operations**
   - Wallet creation success rates
   - Transaction volumes by type
   - Operation performance metrics
   - ChipiPay API health

### Widget Types

- **Metric Cards**: Display single metric values with trends
- **Line Charts**: Time series data visualization
- **Bar Charts**: Categorical data comparison
- **Pie Charts**: Proportional data display
- **Tables**: Detailed data listings
- **Alert Lists**: Recent alert summaries
- **Health Status**: System component health overview

### Creating Custom Dashboards

```typescript
import { dashboardService, WidgetType } from '../lib/dashboard';

const customDashboard = dashboardService.createDashboard({
  id: 'custom-dashboard',
  name: 'Custom Monitoring Dashboard',
  description: 'Custom dashboard for specific metrics',
  refreshInterval: 60,
  widgets: [
    {
      id: 'custom-metric',
      type: WidgetType.METRIC_CARD,
      title: 'Custom Metric',
      config: {
        metric: 'custom_metric_total',
        timeRange: 24,
        unit: 'events'
      },
      position: { x: 0, y: 0, width: 2, height: 2 }
    }
  ]
});
```

## API Endpoints

### Health Check API

```bash
# Get overall system health
GET /api/health

# Get detailed health information
GET /api/health?detailed=true

# Get specific service health
GET /api/health?service=database
```

### Metrics API

```bash
# Get aggregated metrics
GET /api/metrics?type=aggregated&timeRange=24

# Get time series data
GET /api/metrics?type=timeseries&metric=api_request_duration_ms&interval=60

# Get metrics summary
GET /api/metrics?type=summary
```

### Dashboard API

```bash
# List all dashboards
GET /api/dashboard?action=list

# Get dashboard configuration
GET /api/dashboard?action=get&id=system-overview

# Get dashboard data
GET /api/dashboard?action=data&id=system-overview

# Get specific widget data
GET /api/dashboard?action=data&id=system-overview&widget=api-response-time
```

### Alerts API

```bash
# Get alert rules
GET /api/alerts?type=rules

# Get active alerts
GET /api/alerts?type=active

# Get alert history
GET /api/alerts?type=history&severity=HIGH&limit=50

# Create alert rule
POST /api/alerts
{
  "action": "create",
  "rule": {
    "name": "Custom Alert",
    "metricName": "custom_metric",
    "conditionType": "THRESHOLD",
    "thresholdValue": 100,
    "comparisonOperator": ">",
    "severity": "HIGH"
  }
}

# Acknowledge alert
POST /api/alerts
{
  "action": "acknowledge",
  "alertId": 123
}
```

## Database Schema

The monitoring system uses several database tables:

### Metrics Table
```sql
CREATE TABLE metrics (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    category VARCHAR(100) NOT NULL,
    value DECIMAL(20, 6) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    labels JSONB,
    metadata JSONB
);
```

### Health Checks Table
```sql
CREATE TABLE health_checks (
    id SERIAL PRIMARY KEY,
    service VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    response_time INTEGER NOT NULL,
    error_message TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata JSONB
);
```

### Alerts Tables
```sql
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    metric_name VARCHAR(255) NOT NULL,
    condition_type VARCHAR(50) NOT NULL,
    threshold_value DECIMAL(20, 6),
    comparison_operator VARCHAR(10),
    time_window_minutes INTEGER DEFAULT 5,
    severity VARCHAR(20) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    labels JSONB
);

CREATE TABLE alert_history (
    id SERIAL PRIMARY KEY,
    alert_id INTEGER NOT NULL REFERENCES alerts(id),
    fired_at TIMESTAMP WITH TIME ZONE NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    metric_value DECIMAL(20, 6),
    message TEXT,
    metadata JSONB
);
```

## Performance Considerations

### Metrics Collection
- Metrics are buffered in memory and flushed periodically
- Buffer size: 100 metrics
- Flush interval: 30 seconds
- Failed flushes are retried automatically

### Database Optimization
- Indexes on frequently queried columns
- Automatic cleanup of old data (configurable retention)
- Pre-aggregated metrics for dashboard performance

### Caching
- Health check results are cached for fast API responses
- Dashboard data includes appropriate cache headers
- Metrics API responses are cached for 30 seconds

## Maintenance

### Data Retention
```sql
-- Clean up old metrics (default: 30 days)
SELECT cleanup_old_metrics(30);

-- Aggregate metrics for dashboard performance
SELECT aggregate_metrics_hourly();
```

### Monitoring the Monitoring System
- The system monitors its own performance
- Metrics collection failures are logged
- Health check service monitors its own health
- Alert evaluation errors are tracked

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Check metrics buffer size
   - Verify database connection pool settings
   - Monitor for memory leaks in custom health checks

2. **Missing Metrics**
   - Verify database connectivity
   - Check metrics collector buffer status
   - Review application logs for flush errors

3. **Alert Fatigue**
   - Review alert thresholds
   - Implement alert acknowledgment
   - Use alert severity levels appropriately

4. **Dashboard Performance**
   - Use pre-aggregated metrics
   - Implement appropriate caching
   - Optimize database queries

### Debugging

Enable debug logging:
```typescript
import { Logger, LogCategory } from '../lib/logging';

const logger = Logger.createWithCorrelationId('debug');
logger.debug('Debug message', { data: 'value' }, LogCategory.SYSTEM);
```

Check system health:
```bash
curl http://localhost:3000/api/health?detailed=true
```

Monitor metrics collection:
```bash
curl http://localhost:3000/api/metrics?type=summary
```

## Security Considerations

- All monitoring APIs require authentication
- Sensitive data is masked in logs and metrics
- Webhook notifications use secure HTTPS endpoints
- Database connections use connection pooling with limits
- Alert acknowledgment requires proper authorization

## Future Enhancements

- Integration with external monitoring systems (Prometheus, Grafana)
- Machine learning-based anomaly detection
- Automated remediation actions
- Mobile push notifications
- Advanced dashboard customization
- Multi-tenant monitoring isolation