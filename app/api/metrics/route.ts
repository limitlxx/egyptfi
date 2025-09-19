/**
 * Metrics API endpoint
 * Provides access to system metrics and aggregated data for dashboards
 */

import { NextRequest, NextResponse } from 'next/server';
import { metricsCollector } from '../../../lib/metrics';
import { Logger, LogCategory } from '../../../lib/logging';
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
    const type = searchParams.get('type') || 'aggregated';
    const timeRange = parseInt(searchParams.get('timeRange') || '24'); // hours
    const metricName = searchParams.get('metric');
    const interval = parseInt(searchParams.get('interval') || '60'); // minutes

    let metricsData;

    switch (type) {
      case 'aggregated':
        // Get aggregated metrics for dashboard
        metricsData = await metricsCollector.getAggregatedMetrics(timeRange);
        break;

      case 'timeseries':
        if (!metricName) {
          return NextResponse.json(
            { error: 'metric parameter required for timeseries data' },
            { status: 400 }
          );
        }
        
        // Parse labels from query parameters
        const labels: Record<string, string> = {};
        for (const [key, value] of searchParams.entries()) {
          if (key.startsWith('label.')) {
            const labelKey = key.substring(6); // Remove 'label.' prefix
            labels[labelKey] = value;
          }
        }

        metricsData = await metricsCollector.getTimeSeriesData(
          metricName,
          timeRange,
          interval,
          Object.keys(labels).length > 0 ? labels : undefined
        );
        break;

      case 'summary':
        // Get summary metrics
        const aggregated = await metricsCollector.getAggregatedMetrics(timeRange);
        metricsData = {
          summary: {
            totalWalletOperations: aggregated.totalWalletOperations,
            activeUsers: aggregated.activeUsers,
            averageResponseTime: aggregated.averageApiResponseTime,
            systemHealth: aggregated.chipipayApiHealth
          },
          successRates: {
            walletCreation: aggregated.walletCreationSuccessRate,
            transactions: aggregated.transactionSuccessRates
          },
          errorRates: aggregated.errorRatesByCategory,
          timestamp: new Date()
        };
        break;

      default:
        return NextResponse.json(
          { error: `Unknown metrics type: ${type}` },
          { status: 400 }
        );
    }

    const responseTime = Date.now() - startTime;

    // Record metrics for this API call
    metricsCollector.recordApiRequest(
      'GET',
      '/api/metrics',
      200,
      responseTime,
      authResult.merchant?.merchantId
    );

    logger.info('Metrics API request completed', {
      type,
      timeRange,
      metricName,
      interval,
      responseTime,
      merchantId: authResult.merchant?.merchantId
    }, LogCategory.API_REQUEST);

    return NextResponse.json(metricsData, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=30', // Cache for 30 seconds
        'X-Response-Time': `${responseTime}ms`
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    // logger.error('Metrics API error', error, {
    //   responseTime
    // }, LogCategory.API_REQUEST);

    // Record error metrics
    metricsCollector.recordApiRequest(
      'GET',
      '/api/metrics',
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