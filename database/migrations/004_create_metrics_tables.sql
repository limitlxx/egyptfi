-- Migration: Create metrics and health monitoring tables
-- Description: Creates tables for storing metrics, health check results, and monitoring data

-- Create metrics table for storing all metric data
CREATE TABLE IF NOT EXISTS metrics (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('COUNTER', 'GAUGE', 'HISTOGRAM', 'TIMER')),
    category VARCHAR(100) NOT NULL,
    value DECIMAL(20, 6) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    labels JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_metrics_name_timestamp ON metrics (name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_category_timestamp ON metrics (category, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_labels ON metrics USING GIN (labels);

-- Create health_checks table for storing health check results
CREATE TABLE IF NOT EXISTS health_checks (
    id SERIAL PRIMARY KEY,
    service VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('HEALTHY', 'DEGRADED', 'UNHEALTHY')),
    response_time INTEGER NOT NULL, -- in milliseconds
    error_message TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for health checks
CREATE INDEX IF NOT EXISTS idx_health_checks_service_timestamp ON health_checks (service, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_health_checks_status_timestamp ON health_checks (status, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_health_checks_timestamp ON health_checks (timestamp DESC);

-- Create aggregated_metrics table for pre-computed dashboard metrics
CREATE TABLE IF NOT EXISTS aggregated_metrics (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(255) NOT NULL,
    aggregation_type VARCHAR(50) NOT NULL CHECK (aggregation_type IN ('SUM', 'AVG', 'COUNT', 'MIN', 'MAX')),
    time_bucket TIMESTAMP WITH TIME ZONE NOT NULL,
    bucket_size_minutes INTEGER NOT NULL,
    value DECIMAL(20, 6) NOT NULL,
    labels JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (metric_name, aggregation_type, time_bucket, bucket_size_minutes, labels)
);

-- Create indexes for aggregated metrics
CREATE INDEX IF NOT EXISTS idx_aggregated_metrics_name_bucket ON aggregated_metrics (metric_name, time_bucket DESC);
CREATE INDEX IF NOT EXISTS idx_aggregated_metrics_bucket ON aggregated_metrics (time_bucket DESC);

-- Create alerts table for storing alert configurations and history
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    metric_name VARCHAR(255) NOT NULL,
    condition_type VARCHAR(50) NOT NULL CHECK (condition_type IN ('THRESHOLD', 'RATE', 'ABSENCE')),
    threshold_value DECIMAL(20, 6),
    comparison_operator VARCHAR(10) CHECK (comparison_operator IN ('>', '<', '>=', '<=', '=', '!=')),
    time_window_minutes INTEGER DEFAULT 5,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    enabled BOOLEAN DEFAULT true,
    labels JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create alert_history table for storing fired alerts
CREATE TABLE IF NOT EXISTS alert_history (
    id SERIAL PRIMARY KEY,
    alert_id INTEGER NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    fired_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RESOLVED', 'ACKNOWLEDGED')),
    metric_value DECIMAL(20, 6),
    message TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for alerts
CREATE INDEX IF NOT EXISTS idx_alert_history_alert_id_fired ON alert_history (alert_id, fired_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_history_status_fired ON alert_history (status, fired_at DESC);

-- Create system_status table for overall system health tracking
CREATE TABLE IF NOT EXISTS system_status (
    id SERIAL PRIMARY KEY,
    overall_status VARCHAR(20) NOT NULL CHECK (overall_status IN ('HEALTHY', 'DEGRADED', 'UNHEALTHY')),
    healthy_services INTEGER NOT NULL DEFAULT 0,
    degraded_services INTEGER NOT NULL DEFAULT 0,
    unhealthy_services INTEGER NOT NULL DEFAULT 0,
    total_services INTEGER NOT NULL DEFAULT 0,
    uptime_seconds BIGINT NOT NULL DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    metadata JSONB
);

-- Create index for system status
CREATE INDEX IF NOT EXISTS idx_system_status_timestamp ON system_status (timestamp DESC);

-- Create function to clean up old metrics data
CREATE OR REPLACE FUNCTION cleanup_old_metrics(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete metrics older than retention period
    DELETE FROM metrics 
    WHERE timestamp < NOW() - INTERVAL '1 day' * retention_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete health checks older than retention period
    DELETE FROM health_checks 
    WHERE timestamp < NOW() - INTERVAL '1 day' * retention_days;
    
    -- Delete aggregated metrics older than retention period (keep longer for historical data)
    DELETE FROM aggregated_metrics 
    WHERE time_bucket < NOW() - INTERVAL '1 day' * (retention_days * 2);
    
    -- Delete resolved alert history older than retention period
    DELETE FROM alert_history 
    WHERE resolved_at IS NOT NULL 
    AND resolved_at < NOW() - INTERVAL '1 day' * retention_days;
    
    -- Delete old system status records (keep last 7 days of detailed records)
    DELETE FROM system_status 
    WHERE timestamp < NOW() - INTERVAL '7 days';
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to aggregate metrics for dashboard performance
CREATE OR REPLACE FUNCTION aggregate_metrics_hourly()
RETURNS VOID AS $$
BEGIN
    -- Aggregate metrics by hour for the last 2 hours
    INSERT INTO aggregated_metrics (metric_name, aggregation_type, time_bucket, bucket_size_minutes, value, labels)
    SELECT 
        name as metric_name,
        'AVG' as aggregation_type,
        date_trunc('hour', timestamp) as time_bucket,
        60 as bucket_size_minutes,
        AVG(value) as value,
        labels
    FROM metrics 
    WHERE timestamp >= NOW() - INTERVAL '2 hours'
    AND timestamp < date_trunc('hour', NOW())
    GROUP BY name, date_trunc('hour', timestamp), labels
    ON CONFLICT (metric_name, aggregation_type, time_bucket, bucket_size_minutes, labels) 
    DO UPDATE SET value = EXCLUDED.value;
    
    -- Aggregate SUM metrics
    INSERT INTO aggregated_metrics (metric_name, aggregation_type, time_bucket, bucket_size_minutes, value, labels)
    SELECT 
        name as metric_name,
        'SUM' as aggregation_type,
        date_trunc('hour', timestamp) as time_bucket,
        60 as bucket_size_minutes,
        SUM(value) as value,
        labels
    FROM metrics 
    WHERE timestamp >= NOW() - INTERVAL '2 hours'
    AND timestamp < date_trunc('hour', NOW())
    AND type IN ('COUNTER')
    GROUP BY name, date_trunc('hour', timestamp), labels
    ON CONFLICT (metric_name, aggregation_type, time_bucket, bucket_size_minutes, labels) 
    DO UPDATE SET value = EXCLUDED.value;
    
    -- Aggregate COUNT metrics
    INSERT INTO aggregated_metrics (metric_name, aggregation_type, time_bucket, bucket_size_minutes, value, labels)
    SELECT 
        name as metric_name,
        'COUNT' as aggregation_type,
        date_trunc('hour', timestamp) as time_bucket,
        60 as bucket_size_minutes,
        COUNT(*) as value,
        labels
    FROM metrics 
    WHERE timestamp >= NOW() - INTERVAL '2 hours'
    AND timestamp < date_trunc('hour', NOW())
    GROUP BY name, date_trunc('hour', timestamp), labels
    ON CONFLICT (metric_name, aggregation_type, time_bucket, bucket_size_minutes, labels) 
    DO UPDATE SET value = EXCLUDED.value;
END;
$$ LANGUAGE plpgsql;

-- Insert default alert configurations
INSERT INTO alerts (name, description, metric_name, condition_type, threshold_value, comparison_operator, time_window_minutes, severity, labels) VALUES
('High Error Rate', 'Alert when error rate exceeds 5%', 'api_errors_total', 'RATE', 5.0, '>', 5, 'HIGH', '{}'),
('ChipiPay API Down', 'Alert when ChipiPay API health check fails', 'chipipay_api_calls_total', 'THRESHOLD', 0.8, '<', 5, 'CRITICAL', '{"success": "true"}'),
('High Response Time', 'Alert when API response time exceeds 5 seconds', 'api_request_duration_ms', 'THRESHOLD', 5000.0, '>', 10, 'MEDIUM', '{}'),
('Database Connection Issues', 'Alert when database health check fails', 'system_health_status', 'THRESHOLD', 0.5, '<', 5, 'CRITICAL', '{"component": "database"}'),
('Memory Usage High', 'Alert when memory usage exceeds 90%', 'system_health_status', 'THRESHOLD', 0.1, '<', 5, 'HIGH', '{"component": "memory"}'),
('Wallet Operation Failures', 'Alert when wallet operation failure rate exceeds 10%', 'wallet_operations_failure_total', 'RATE', 10.0, '>', 15, 'HIGH', '{}')
ON CONFLICT (name) DO NOTHING;

-- Create a view for easy dashboard queries
CREATE OR REPLACE VIEW dashboard_metrics AS
SELECT 
    m.name,
    m.category,
    m.value,
    m.timestamp,
    m.labels,
    CASE 
        WHEN m.labels->>'success' = 'true' THEN 'success'
        WHEN m.labels->>'success' = 'false' THEN 'failure'
        ELSE 'unknown'
    END as status_category
FROM metrics m
WHERE m.timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY m.timestamp DESC;

-- Create a view for system health summary
CREATE OR REPLACE VIEW system_health_summary AS
SELECT 
    h.service,
    h.status,
    h.response_time,
    h.timestamp,
    h.error_message,
    ROW_NUMBER() OVER (PARTITION BY h.service ORDER BY h.timestamp DESC) as rn
FROM health_checks h
WHERE h.timestamp >= NOW() - INTERVAL '1 hour';

COMMENT ON TABLE metrics IS 'Stores all application metrics for monitoring and alerting';
COMMENT ON TABLE health_checks IS 'Stores health check results for system components';
COMMENT ON TABLE aggregated_metrics IS 'Pre-computed metric aggregations for dashboard performance';
COMMENT ON TABLE alerts IS 'Alert configuration and rules';
COMMENT ON TABLE alert_history IS 'History of fired alerts and their resolution';
COMMENT ON TABLE system_status IS 'Overall system health status over time';