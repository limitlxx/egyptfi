/**
 * Alerts API endpoint
 * Provides access to alert rules, active alerts, and alert history
 */

import { NextRequest, NextResponse } from 'next/server';
import { alertingService, AlertSeverity, AlertStatus, AlertConditionType, ComparisonOperator } from '../../../lib/alerting';
import { Logger, LogCategory } from '../../../lib/logging';
import { metricsCollector } from '../../../lib/metrics';
import { AuthMiddleware } from '../../../lib/auth-middleware';

const logger = Logger.createWithCorrelationId();

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Apply authentication middleware
    const authResult = await AuthMiddleware.validateApiKey(
      request.headers.get('x-api-key') || ''
    );
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'rules';
    const ruleId = searchParams.get('ruleId');
    const severity = searchParams.get('severity') as AlertSeverity;
    const status = searchParams.get('status') as AlertStatus;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let responseData;

    switch (type) {
      case 'rules':
        // Get all alert rules
        responseData = alertingService.getAlertRules();
        break;

      case 'active':
        // Get active alerts
        responseData = alertingService.getActiveAlerts();
        break;

      case 'history':
        // Get alert history with optional filters
        const historyOptions: any = { limit, offset };
        
        if (ruleId) historyOptions.ruleId = parseInt(ruleId);
        if (severity) historyOptions.severity = severity;
        if (status) historyOptions.status = status;

        // Parse date filters
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        if (startDate) historyOptions.startDate = new Date(startDate);
        if (endDate) historyOptions.endDate = new Date(endDate);

        responseData = await alertingService.getAlertHistory(historyOptions);
        break;

      case 'summary':
        // Get alert summary statistics
        const allRules = alertingService.getAlertRules();
        const activeAlerts = alertingService.getActiveAlerts();
        const recentHistory = await alertingService.getAlertHistory({ limit: 100 });

        // Calculate statistics
        const severityCounts = activeAlerts.reduce((acc, alert) => {
          const severity = alert.metadata?.severity || 'UNKNOWN';
          acc[severity] = (acc[severity] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentAlerts = recentHistory.filter(alert => alert.firedAt >= last24Hours);

        responseData = {
          totalRules: allRules.length,
          enabledRules: allRules.filter(rule => rule.enabled).length,
          activeAlerts: activeAlerts.length,
          alertsLast24h: recentAlerts.length,
          severityBreakdown: severityCounts,
          topAlertRules: recentHistory
            .reduce((acc, alert) => {
              const ruleId = alert.alertId;
              acc[ruleId] = (acc[ruleId] || 0) + 1;
              return acc;
            }, {} as Record<number, number>)
        };
        break;

      default:
        return NextResponse.json(
          { error: `Unknown type: ${type}` },
          { status: 400 }
        );
    }

    const responseTime = Date.now() - startTime;

    // Record metrics
    metricsCollector.recordApiRequest(
      'GET',
      '/api/alerts',
      200,
      responseTime,
      authResult.merchant?.merchantId
    );

    logger.info('Alerts API request completed', {
      type,
      ruleId,
      severity,
      status,
      limit,
      offset,
      responseTime,
      merchantId: authResult.merchant?.merchantId
    }, LogCategory.API_REQUEST);

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Cache-Control': type === 'active' ? 'no-cache' : 'public, max-age=60',
        'X-Response-Time': `${responseTime}ms`
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Alerts API error', error, {
      responseTime
    }, LogCategory.API_REQUEST);

    // Record error metrics
    metricsCollector.recordApiRequest(
      'GET',
      '/api/alerts',
      500,
      responseTime
    );

    return NextResponse.json(
      { 
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Apply authentication middleware
    const authResult = await AuthMiddleware.validateApiKey(
      request.headers.get('x-api-key') || ''
    );
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action } = body;

    let responseData;

    switch (action) {
      case 'create':
        const { rule } = body;
        
        // Validate required fields
        if (!rule || !rule.name || !rule.metricName || !rule.conditionType || !rule.severity) {
          return NextResponse.json(
            { error: 'Missing required fields: name, metricName, conditionType, severity' },
            { status: 400 }
          );
        }

        // Validate enum values
        if (!Object.values(AlertConditionType).includes(rule.conditionType)) {
          return NextResponse.json(
            { error: 'Invalid condition type' },
            { status: 400 }
          );
        }

        if (!Object.values(AlertSeverity).includes(rule.severity)) {
          return NextResponse.json(
            { error: 'Invalid severity level' },
            { status: 400 }
          );
        }

        if (rule.comparisonOperator && !Object.values(ComparisonOperator).includes(rule.comparisonOperator)) {
          return NextResponse.json(
            { error: 'Invalid comparison operator' },
            { status: 400 }
          );
        }

        responseData = await alertingService.createAlertRule({
          name: rule.name,
          description: rule.description || '',
          metricName: rule.metricName,
          conditionType: rule.conditionType,
          thresholdValue: rule.thresholdValue,
          comparisonOperator: rule.comparisonOperator,
          timeWindowMinutes: rule.timeWindowMinutes || 5,
          severity: rule.severity,
          enabled: rule.enabled !== false,
          labels: rule.labels || {}
        });
        break;

      case 'update':
        const { ruleId, updates } = body;
        
        if (!ruleId || !updates) {
          return NextResponse.json(
            { error: 'Rule ID and updates required' },
            { status: 400 }
          );
        }

        responseData = await alertingService.updateAlertRule(ruleId, updates);
        
        if (!responseData) {
          return NextResponse.json(
            { error: 'Alert rule not found' },
            { status: 404 }
          );
        }
        break;

      case 'acknowledge':
        const { alertId } = body;
        
        if (!alertId) {
          return NextResponse.json(
            { error: 'Alert ID required' },
            { status: 400 }
          );
        }

        const acknowledged = await alertingService.acknowledgeAlert(alertId);
        
        if (!acknowledged) {
          return NextResponse.json(
            { error: 'Alert not found or already acknowledged' },
            { status: 404 }
          );
        }

        responseData = { success: true, message: 'Alert acknowledged successfully' };
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    const responseTime = Date.now() - startTime;

    // Record metrics
    metricsCollector.recordApiRequest(
      'POST',
      '/api/alerts',
      200,
      responseTime,
      authResult.merchant?.merchantId
    );

    logger.info('Alerts API POST request completed', {
      action,
      responseTime,
      merchantId: authResult.merchant?.merchantId
    }, LogCategory.API_REQUEST);

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'X-Response-Time': `${responseTime}ms`
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Alerts API POST error', error, {
      responseTime
    }, LogCategory.API_REQUEST);

    // Record error metrics
    metricsCollector.recordApiRequest(
      'POST',
      '/api/alerts',
      500,
      responseTime
    );

    return NextResponse.json(
      { 
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Apply authentication middleware
    const authResult = await AuthMiddleware.validateApiKey(
      request.headers.get('x-api-key') || ''
    );
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('ruleId');

    if (!ruleId) {
      return NextResponse.json(
        { error: 'Rule ID required' },
        { status: 400 }
      );
    }

    const deleted = await alertingService.deleteAlertRule(parseInt(ruleId));
    
    if (!deleted) {
      return NextResponse.json(
        { error: 'Alert rule not found' },
        { status: 404 }
      );
    }

    const responseTime = Date.now() - startTime;

    // Record metrics
    metricsCollector.recordApiRequest(
      'DELETE',
      '/api/alerts',
      200,
      responseTime,
      authResult.merchant?.merchantId
    );

    logger.info('Alert rule deleted', {
      ruleId,
      responseTime,
      merchantId: authResult.merchant?.merchantId
    }, LogCategory.API_REQUEST);

    return NextResponse.json(
      { success: true, message: 'Alert rule deleted successfully' },
      {
        status: 200,
        headers: {
          'X-Response-Time': `${responseTime}ms`
        }
      }
    );

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Alerts API DELETE error', error, {
      responseTime
    }, LogCategory.API_REQUEST);

    // Record error metrics
    metricsCollector.recordApiRequest(
      'DELETE',
      '/api/alerts',
      500,
      responseTime
    );

    return NextResponse.json(
      { 
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}