/**
 * Alerting system for monitoring critical system events
 * Provides real-time alerting based on metrics thresholds and system health
 */

import pool from './db';
import { Logger, LogCategory } from './logging';
import { metricsCollector, MetricCategory } from './metrics';

// Alert severity levels
export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

// Alert condition types
export enum AlertConditionType {
  THRESHOLD = 'THRESHOLD',
  RATE = 'RATE',
  ABSENCE = 'ABSENCE'
}

// Alert status
export enum AlertStatus {
  ACTIVE = 'ACTIVE',
  RESOLVED = 'RESOLVED',
  ACKNOWLEDGED = 'ACKNOWLEDGED'
}

// Comparison operators
export enum ComparisonOperator {
  GREATER_THAN = '>',
  LESS_THAN = '<',
  GREATER_THAN_OR_EQUAL = '>=',
  LESS_THAN_OR_EQUAL = '<=',
  EQUAL = '=',
  NOT_EQUAL = '!='
}

// Alert rule configuration
interface AlertRule {
  id?: number;
  name: string;
  description: string;
  metricName: string;
  conditionType: AlertConditionType;
  thresholdValue?: number;
  comparisonOperator?: ComparisonOperator;
  timeWindowMinutes: number;
  severity: AlertSeverity;
  enabled: boolean;
  labels?: Record<string, string>;
  createdAt?: Date;
  updatedAt?: Date;
}

// Alert instance
interface Alert {
  id?: number;
  alertId: number;
  firedAt: Date;
  resolvedAt?: Date;
  status: AlertStatus;
  metricValue?: number;
  message: string;
  metadata?: Record<string, any>;
}

// Alert notification
interface AlertNotification {
  alert: Alert;
  rule: AlertRule;
  timestamp: Date;
  notificationChannels: string[];
}

// Notification channel interface
interface NotificationChannel {
  name: string;
  type: 'email' | 'webhook' | 'slack' | 'console';
  config: Record<string, any>;
  enabled: boolean;
}

export class AlertingService {
  private static instance: AlertingService;
  private logger: Logger;
  private alertRules: Map<number, AlertRule> = new Map();
  private activeAlerts: Map<number, Alert> = new Map();
  private notificationChannels: Map<string, NotificationChannel> = new Map();
  private evaluationInterval: NodeJS.Timeout | null = null;
  private readonly EVALUATION_INTERVAL_MS = 60000; // 1 minute

  private constructor() {
    this.logger = Logger.createWithCorrelationId();
    this.initializeDefaultChannels();
    this.loadAlertRules();
    this.startAlertEvaluation();
  }

  public static getInstance(): AlertingService {
    if (!AlertingService.instance) {
      AlertingService.instance = new AlertingService();
    }
    return AlertingService.instance;
  }

  /**
   * Initialize default notification channels
   */
  private initializeDefaultChannels(): void {
    // Console notification channel (always available)
    this.notificationChannels.set('console', {
      name: 'console',
      type: 'console',
      config: {},
      enabled: true
    });

    // Webhook channel for external integrations
    this.notificationChannels.set('webhook', {
      name: 'webhook',
      type: 'webhook',
      config: {
        url: process.env.ALERT_WEBHOOK_URL || '',
        timeout: 5000
      },
      enabled: !!process.env.ALERT_WEBHOOK_URL
    });

    this.logger.info('Initialized notification channels', {
      channels: Array.from(this.notificationChannels.keys())
    }, LogCategory.SYSTEM);
  }

  /**
   * Load alert rules from database
   */
  private async loadAlertRules(): Promise<void> {
    try {
      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT id, name, description, metric_name, condition_type, threshold_value,
                 comparison_operator, time_window_minutes, severity, enabled, labels,
                 created_at, updated_at
          FROM alerts 
          WHERE enabled = true
          ORDER BY severity DESC, name ASC
        `);

        this.alertRules.clear();
        for (const row of result.rows) {
          const rule: AlertRule = {
            id: row.id,
            name: row.name,
            description: row.description,
            metricName: row.metric_name,
            conditionType: row.condition_type as AlertConditionType,
            thresholdValue: row.threshold_value,
            comparisonOperator: row.comparison_operator as ComparisonOperator,
            timeWindowMinutes: row.time_window_minutes,
            severity: row.severity as AlertSeverity,
            enabled: row.enabled,
            labels: row.labels || {},
            createdAt: row.created_at,
            updatedAt: row.updated_at
          };
          
          this.alertRules.set(rule.id!, rule);
        }

        this.logger.info(`Loaded ${this.alertRules.size} alert rules`, {
          ruleCount: this.alertRules.size
        }, LogCategory.SYSTEM);
      } finally {
        client.release();
      }
    } catch (error) {
      this.logger.error('Failed to load alert rules', error, {}, LogCategory.SYSTEM);
    }
  }

  /**
   * Create a new alert rule
   */
  public async createAlertRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<AlertRule> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO alerts (name, description, metric_name, condition_type, threshold_value,
                           comparison_operator, time_window_minutes, severity, enabled, labels)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, created_at, updated_at
      `, [
        rule.name,
        rule.description,
        rule.metricName,
        rule.conditionType,
        rule.thresholdValue,
        rule.comparisonOperator,
        rule.timeWindowMinutes,
        rule.severity,
        rule.enabled,
        rule.labels ? JSON.stringify(rule.labels) : null
      ]);

      const newRule: AlertRule = {
        ...rule,
        id: result.rows[0].id,
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at
      };

      this.alertRules.set(newRule.id!, newRule);

      this.logger.info('Created new alert rule', {
        ruleId: newRule.id,
        ruleName: newRule.name,
        severity: newRule.severity
      }, LogCategory.SYSTEM);

      return newRule;
    } finally {
      client.release();
    }
  }

  /**
   * Update an existing alert rule
   */
  public async updateAlertRule(id: number, updates: Partial<AlertRule>): Promise<AlertRule | null> {
    const existingRule = this.alertRules.get(id);
    if (!existingRule) {
      return null;
    }

    const client = await pool.connect();
    try {
      const updatedRule = { ...existingRule, ...updates, updatedAt: new Date() };
      
      await client.query(`
        UPDATE alerts 
        SET name = $1, description = $2, metric_name = $3, condition_type = $4,
            threshold_value = $5, comparison_operator = $6, time_window_minutes = $7,
            severity = $8, enabled = $9, labels = $10, updated_at = NOW()
        WHERE id = $11
      `, [
        updatedRule.name,
        updatedRule.description,
        updatedRule.metricName,
        updatedRule.conditionType,
        updatedRule.thresholdValue,
        updatedRule.comparisonOperator,
        updatedRule.timeWindowMinutes,
        updatedRule.severity,
        updatedRule.enabled,
        updatedRule.labels ? JSON.stringify(updatedRule.labels) : null,
        id
      ]);

      this.alertRules.set(id, updatedRule);

      this.logger.info('Updated alert rule', {
        ruleId: id,
        ruleName: updatedRule.name
      }, LogCategory.SYSTEM);

      return updatedRule;
    } finally {
      client.release();
    }
  }

  /**
   * Delete an alert rule
   */
  public async deleteAlertRule(id: number): Promise<boolean> {
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM alerts WHERE id = $1', [id]);
      
      if (result.rowCount > 0) {
        this.alertRules.delete(id);
        this.logger.info('Deleted alert rule', { ruleId: id }, LogCategory.SYSTEM);
        return true;
      }
      
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Start periodic alert evaluation
   */
  private startAlertEvaluation(): void {
    this.evaluationInterval = setInterval(() => {
      this.evaluateAlerts().catch(error => {
        this.logger.error('Alert evaluation failed', error, {}, LogCategory.SYSTEM);
      });
    }, this.EVALUATION_INTERVAL_MS);

    this.logger.info('Started alert evaluation', {
      interval: this.EVALUATION_INTERVAL_MS
    }, LogCategory.SYSTEM);
  }

  /**
   * Evaluate all alert rules
   */
  private async evaluateAlerts(): Promise<void> {
    const evaluationPromises = Array.from(this.alertRules.values())
      .filter(rule => rule.enabled)
      .map(rule => this.evaluateAlertRule(rule));

    await Promise.allSettled(evaluationPromises);
  }

  /**
   * Evaluate a single alert rule
   */
  private async evaluateAlertRule(rule: AlertRule): Promise<void> {
    try {
      const shouldAlert = await this.checkAlertCondition(rule);
      const existingAlert = Array.from(this.activeAlerts.values())
        .find(alert => alert.alertId === rule.id && alert.status === AlertStatus.ACTIVE);

      if (shouldAlert && !existingAlert) {
        // Fire new alert
        await this.fireAlert(rule);
      } else if (!shouldAlert && existingAlert) {
        // Resolve existing alert
        await this.resolveAlert(existingAlert.id!);
      }
    } catch (error) {
      this.logger.error('Failed to evaluate alert rule', error, {
        ruleId: rule.id,
        ruleName: rule.name
      }, LogCategory.SYSTEM);
    }
  }

  /**
   * Check if alert condition is met
   */
  private async checkAlertCondition(rule: AlertRule): Promise<boolean> {
    const client = await pool.connect();
    try {
      const timeWindow = new Date(Date.now() - rule.timeWindowMinutes * 60 * 1000);
      
      switch (rule.conditionType) {
        case AlertConditionType.THRESHOLD:
          return await this.checkThresholdCondition(client, rule, timeWindow);
        
        case AlertConditionType.RATE:
          return await this.checkRateCondition(client, rule, timeWindow);
        
        case AlertConditionType.ABSENCE:
          return await this.checkAbsenceCondition(client, rule, timeWindow);
        
        default:
          this.logger.warn('Unknown alert condition type', {
            conditionType: rule.conditionType,
            ruleId: rule.id
          }, LogCategory.SYSTEM);
          return false;
      }
    } finally {
      client.release();
    }
  }

  /**
   * Check threshold-based condition
   */
  private async checkThresholdCondition(client: any, rule: AlertRule, timeWindow: Date): Promise<boolean> {
    let query = `
      SELECT AVG(value) as avg_value, MAX(value) as max_value, MIN(value) as min_value
      FROM metrics 
      WHERE name = $1 AND timestamp >= $2
    `;
    const params: any[] = [rule.metricName, timeWindow];

    // Add label filters if specified
    if (rule.labels && Object.keys(rule.labels).length > 0) {
      Object.entries(rule.labels).forEach(([key, value], index) => {
        query += ` AND labels->>'${key}' = $${params.length + 1}`;
        params.push(value);
      });
    }

    const result = await client.query(query, params);
    
    if (result.rows.length === 0 || result.rows[0].avg_value === null) {
      return false;
    }

    const metricValue = parseFloat(result.rows[0].avg_value);
    const threshold = rule.thresholdValue!;

    switch (rule.comparisonOperator) {
      case ComparisonOperator.GREATER_THAN:
        return metricValue > threshold;
      case ComparisonOperator.LESS_THAN:
        return metricValue < threshold;
      case ComparisonOperator.GREATER_THAN_OR_EQUAL:
        return metricValue >= threshold;
      case ComparisonOperator.LESS_THAN_OR_EQUAL:
        return metricValue <= threshold;
      case ComparisonOperator.EQUAL:
        return Math.abs(metricValue - threshold) < 0.001;
      case ComparisonOperator.NOT_EQUAL:
        return Math.abs(metricValue - threshold) >= 0.001;
      default:
        return false;
    }
  }

  /**
   * Check rate-based condition (e.g., error rate)
   */
  private async checkRateCondition(client: any, rule: AlertRule, timeWindow: Date): Promise<boolean> {
    // For rate conditions, we calculate the percentage of events meeting criteria
    let successQuery = `
      SELECT COUNT(*) as success_count
      FROM metrics 
      WHERE name = $1 AND timestamp >= $2 AND labels->>'success' = 'true'
    `;
    
    let totalQuery = `
      SELECT COUNT(*) as total_count
      FROM metrics 
      WHERE name = $1 AND timestamp >= $2
    `;

    const params = [rule.metricName, timeWindow];

    const [successResult, totalResult] = await Promise.all([
      client.query(successQuery, params),
      client.query(totalQuery, params)
    ]);

    const successCount = parseInt(successResult.rows[0]?.success_count || '0');
    const totalCount = parseInt(totalResult.rows[0]?.total_count || '0');

    if (totalCount === 0) {
      return false;
    }

    const successRate = (successCount / totalCount) * 100;
    const failureRate = 100 - successRate;

    // For rate conditions, threshold is typically a failure rate percentage
    return failureRate > (rule.thresholdValue || 0);
  }

  /**
   * Check absence condition (no data received)
   */
  private async checkAbsenceCondition(client: any, rule: AlertRule, timeWindow: Date): Promise<boolean> {
    let query = `
      SELECT COUNT(*) as count
      FROM metrics 
      WHERE name = $1 AND timestamp >= $2
    `;
    const params = [rule.metricName, timeWindow];

    const result = await client.query(query, params);
    const count = parseInt(result.rows[0]?.count || '0');

    return count === 0;
  }

  /**
   * Fire a new alert
   */
  private async fireAlert(rule: AlertRule): Promise<void> {
    const alert: Alert = {
      alertId: rule.id!,
      firedAt: new Date(),
      status: AlertStatus.ACTIVE,
      message: `Alert: ${rule.name} - ${rule.description}`,
      metadata: {
        severity: rule.severity,
        metricName: rule.metricName,
        conditionType: rule.conditionType
      }
    };

    // Store alert in database
    const client = await pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO alert_history (alert_id, fired_at, status, metric_value, message, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [
        alert.alertId,
        alert.firedAt,
        alert.status,
        alert.metricValue,
        alert.message,
        alert.metadata ? JSON.stringify(alert.metadata) : null
      ]);

      alert.id = result.rows[0].id;
      this.activeAlerts.set(alert.id, alert);

      // Send notifications
      await this.sendAlertNotification({
        alert,
        rule,
        timestamp: new Date(),
        notificationChannels: Array.from(this.notificationChannels.keys())
      });

      // Record metrics
      metricsCollector.incrementCounter(
        'alerts_fired_total',
        MetricCategory.SYSTEM_HEALTH,
        1,
        { severity: rule.severity, rule_name: rule.name }
      );

      this.logger.warn('Alert fired', {
        alertId: alert.id,
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity
      }, LogCategory.SYSTEM);
    } finally {
      client.release();
    }
  }

  /**
   * Resolve an active alert
   */
  private async resolveAlert(alertId: number): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return;
    }

    const client = await pool.connect();
    try {
      await client.query(`
        UPDATE alert_history 
        SET resolved_at = NOW(), status = $1
        WHERE id = $2
      `, [AlertStatus.RESOLVED, alertId]);

      alert.resolvedAt = new Date();
      alert.status = AlertStatus.RESOLVED;
      this.activeAlerts.delete(alertId);

      this.logger.info('Alert resolved', {
        alertId,
        duration: alert.resolvedAt.getTime() - alert.firedAt.getTime()
      }, LogCategory.SYSTEM);
    } finally {
      client.release();
    }
  }

  /**
   * Send alert notification through configured channels
   */
  private async sendAlertNotification(notification: AlertNotification): Promise<void> {
    const enabledChannels = notification.notificationChannels
      .map(name => this.notificationChannels.get(name))
      .filter(channel => channel?.enabled);

    const notificationPromises = enabledChannels.map(channel => 
      this.sendToChannel(channel!, notification)
    );

    await Promise.allSettled(notificationPromises);
  }

  /**
   * Send notification to specific channel
   */
  private async sendToChannel(channel: NotificationChannel, notification: AlertNotification): Promise<void> {
    try {
      switch (channel.type) {
        case 'console':
          this.sendConsoleNotification(notification);
          break;
        
        case 'webhook':
          await this.sendWebhookNotification(channel, notification);
          break;
        
        default:
          this.logger.warn('Unknown notification channel type', {
            channelType: channel.type,
            channelName: channel.name
          }, LogCategory.SYSTEM);
      }
    } catch (error) {
      this.logger.error('Failed to send notification', error, {
        channelName: channel.name,
        channelType: channel.type,
        alertId: notification.alert.id
      }, LogCategory.SYSTEM);
    }
  }

  /**
   * Send console notification
   */
  private sendConsoleNotification(notification: AlertNotification): void {
    const { alert, rule } = notification;
    
    console.log(`
🚨 ALERT FIRED 🚨
Rule: ${rule.name}
Severity: ${rule.severity}
Description: ${rule.description}
Metric: ${rule.metricName}
Time: ${alert.firedAt.toISOString()}
Message: ${alert.message}
    `);
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(channel: NotificationChannel, notification: AlertNotification): Promise<void> {
    if (!channel.config.url) {
      return;
    }

    const payload = {
      alert: {
        id: notification.alert.id,
        status: notification.alert.status,
        firedAt: notification.alert.firedAt,
        message: notification.alert.message
      },
      rule: {
        name: notification.rule.name,
        severity: notification.rule.severity,
        description: notification.rule.description,
        metricName: notification.rule.metricName
      },
      timestamp: notification.timestamp
    };

    const response = await fetch(channel.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(channel.config.timeout || 5000)
    });

    if (!response.ok) {
      throw new Error(`Webhook notification failed: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Get all alert rules
   */
  public getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert history
   */
  public async getAlertHistory(options: {
    ruleId?: number;
    severity?: AlertSeverity;
    status?: AlertStatus;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<Alert[]> {
    const { ruleId, severity, status, startDate, endDate, limit = 100, offset = 0 } = options;

    const client = await pool.connect();
    try {
      let query = `
        SELECT ah.*, a.name as rule_name, a.severity as rule_severity
        FROM alert_history ah
        JOIN alerts a ON ah.alert_id = a.id
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIndex = 1;

      if (ruleId) {
        query += ` AND ah.alert_id = $${paramIndex}`;
        params.push(ruleId);
        paramIndex++;
      }

      if (severity) {
        query += ` AND a.severity = $${paramIndex}`;
        params.push(severity);
        paramIndex++;
      }

      if (status) {
        query += ` AND ah.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (startDate) {
        query += ` AND ah.fired_at >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        query += ` AND ah.fired_at <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      query += ` ORDER BY ah.fired_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await client.query(query, params);
      
      return result.rows.map(row => ({
        id: row.id,
        alertId: row.alert_id,
        firedAt: row.fired_at,
        resolvedAt: row.resolved_at,
        status: row.status as AlertStatus,
        metricValue: row.metric_value,
        message: row.message,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Acknowledge an alert
   */
  public async acknowledgeAlert(alertId: number): Promise<boolean> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        UPDATE alert_history 
        SET status = $1
        WHERE id = $2 AND status = $3
      `, [AlertStatus.ACKNOWLEDGED, alertId, AlertStatus.ACTIVE]);

      if (result.rowCount > 0) {
        const alert = this.activeAlerts.get(alertId);
        if (alert) {
          alert.status = AlertStatus.ACKNOWLEDGED;
        }

        this.logger.info('Alert acknowledged', { alertId }, LogCategory.SYSTEM);
        return true;
      }

      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Shutdown alerting service
   */
  public shutdown(): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
    }

    this.logger.info('Alerting service shutdown complete', {}, LogCategory.SYSTEM);
  }
}

// Export singleton instance
export const alertingService = AlertingService.getInstance();