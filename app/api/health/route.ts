/**
 * Health check API endpoint
 * Provides system health status and individual service health checks
 */

import { NextRequest, NextResponse } from 'next/server';
import { healthCheckService } from '../../../lib/health-checks';
import { metricsCollector } from '../../../lib/metrics';
import { Logger, LogCategory } from '../../../lib/logging';

const logger = Logger.createWithCorrelationId();

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const service = searchParams.get('service');
    const detailed = searchParams.get('detailed') === 'true';

    let healthData;

    if (service) {
      // Get health for specific service
      const serviceHealth = healthCheckService.getServiceHealth(service);
      
      if (!serviceHealth) {
        return NextResponse.json(
          { error: `Service '${service}' not found` },
          { status: 404 }
        );
      }

      healthData = serviceHealth;
    } else {
      // Get overall system health
      if (detailed) {
        healthData = await healthCheckService.runAllHealthChecks();
      } else {
        // Return cached results for faster response
        const lastResults = healthCheckService.getLastHealthResults();
        const services = Array.from(lastResults.values());
        
        // Determine overall status
        const unhealthyCount = services.filter(s => s.status === 'UNHEALTHY').length;
        const degradedCount = services.filter(s => s.status === 'DEGRADED').length;
        
        let overall = 'HEALTHY';
        if (unhealthyCount > 0) {
          overall = 'UNHEALTHY';
        } else if (degradedCount > 0) {
          overall = 'DEGRADED';
        }

        healthData = {
          overall,
          services: services.map(s => ({
            service: s.service,
            status: s.status,
            timestamp: s.timestamp
          })),
          timestamp: new Date(),
          cached: true
        };
      }
    }

    const responseTime = Date.now() - startTime;

    // Record metrics
    metricsCollector.recordApiRequest(
      'GET',
      '/api/health',
      200,
      responseTime
    );

    logger.info('Health check API request completed', {
      service,
      detailed,
      responseTime,
      status: healthData.overall || healthData.status
    }, LogCategory.API_REQUEST);

    return NextResponse.json(healthData, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Response-Time': `${responseTime}ms`
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Health check API error', error, {
      responseTime
    }, LogCategory.API_REQUEST);

    // Record error metrics
    metricsCollector.recordApiRequest(
      'GET',
      '/api/health',
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