/**
 * Dashboard service for system monitoring visualization
 * Provides data aggregation and formatting for monitoring dashboards
 */

import pool from './db';
import { Logger, LogCategory, WalletOperationType } from './logging';
import { metricsCollector, HealthStatus } from './metrics';
import { alertingService, AlertSeverity, AlertStatus } from './alerting';
import { healthCheckService } from './health-checks';

// Dashboard widget types
export enum WidgetType {
  METRIC_CARD = 'METRIC_CARD',
  LINE_CHART = 'LINE_CHART',
  BAR_CHART = 'BAR_CHART',
  PIE_CHART = 'PIE_CHART',
  TABLE = 'TABLE',
  ALERT_LIST = 'ALERT_LIST',
  HEALTH_STATUS = 'HEALTH_STATUS'
}

// Dashboard widget configuration
interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  description?: string;
  config: Record<string, any>;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Dashboard configuration
interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  refreshInterval: number; // seconds
  createdAt: Date;
  updatedAt: Date;
}

// Metric card data
interface MetricCardData {
  value: number;
  unit?: string;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
  };
  status?: 'healthy' | 'warning' | 'critical';
}

// Chart data point
interface ChartDataPoint {
  timestamp: Date;
  value: number;
  label?: string;
}

// Chart series
interface ChartSeries {
  name: string;
  data: ChartDataPoint[];
  color?: string;
}

// Table row
interface TableRow {
  [key: string]: any;
}

// Widget data response
interface WidgetData {
  widgetId: string;
  type: WidgetType;
  data: any;
  lastUpdated: Date;
  error?: string;
}

export class DashboardService {
  private static instance: DashboardService;
  private logger: Logger;
  private dashboards: Map<string, Dashboard> = new Map();

  private constructor() {
    this.logger = Logger.createWithCorrelationId();
    this.initializeDefaultDashboards();
  }

  public static getInstance(): DashboardService {
    if (!DashboardService.instance) {
      DashboardService.instance = new DashboardService();
    }
    return DashboardService.instance;
  }

  /**
   * Initialize default dashboards
   */
  private initializeDefaultDashboards(): void {
    // System Overview Dashboard
    const systemOverviewDashboard: Dashboard = {
      id: 'system-overview',
      name: 'System Overview',
      description: 'High-level system health and performance metrics',
      refreshInterval: 30,
      createdAt: new Date(),
      updatedAt: new Date(),
      widgets: [
        {
          id: 'system-health',
          type: WidgetType.HEALTH_STATUS,
          title: 'System Health',
          config: {},
          position: { x: 0, y: 0, width: 4, height: 2 }
        },
        {
          id: 'wallet-operations',
          type: WidgetType.METRIC_CARD,
          title: 'Total Wallet Operations',
          config: { metric: 'wallet_operations_total', timeRange: 24 },
          position: { x: 4, y: 0, width: 2, height: 2 }
        },
        {
          id: 'active-users',
          type: WidgetType.METRIC_CARD,
          title: 'Active Users',
          config: { metric: 'active_users', timeRange: 24 },
          position: { x: 6, y: 0, width: 2, height: 2 }
        },
        {
          id: 'api-response-time',
          type: WidgetType.LINE_CHART,
          title: 'API Response Time',
          config: { 
            metric: 'api_request_duration_ms',
            timeRange: 24,
            interval: 60
          },
          position: { x: 0, y: 2, width: 6, height: 3 }
        },
        {
          id: 'error-rates',
          type: WidgetType.PIE_CHART,
          title: 'Error Rates by Category',
          config: { timeRange: 24 },
          position: { x: 6, y: 2, width: 2, height: 3 }
        },
        {
          id: 'recent-alerts',
          type: WidgetType.ALERT_LIST,
          title: 'Recent Alerts',
          config: { limit: 10 },
          position: { x: 0, y: 5, width: 8, height: 3 }
        }
      ]
    };

    // Wallet Operations Dashboard
    const walletOperationsDashboard: Dashboard = {
      id: 'wallet-operations',
      name: 'Wallet Operations',
      description: 'Detailed wallet operation metrics and performance',
      refreshInterval: 60,
      createdAt: new Date(),
      updatedAt: new Date(),
      widgets: [
        {
          id: 'wallet-success-rate',
          type: WidgetType.METRIC_CARD,
          title: 'Wallet Creation Success Rate',
          config: { 
            metric: 'wallet_creation_success_rate',
            timeRange: 24,
            unit: '%'
          },
          position: { x: 0, y: 0, width: 2, height: 2 }
        },
        {
          id: 'transaction-volume',
          type: WidgetType.BAR_CHART,
          title: 'Transaction Volume by Type',
          config: { timeRange: 24 },
          position: { x: 2, y: 0, width: 6, height: 3 }
        },
        {
          id: 'operation-success-rates',
          type: WidgetType.TABLE,
          title: 'Operation Success Rates',
          config: { timeRange: 24 },
          position: { x: 0, y: 3, width: 4, height: 3 }
        },
        {
          id: 'chipipay-health',
          type: WidgetType.LINE_CHART,
          title: 'ChipiPay API Health',
          config: {
            metric: 'chipipay_api_response_time_ms',
            timeRange: 24,
            interval: 60
          },
          position: { x: 4, y: 3, width: 4, height: 3 }
        }
      ]
    };

    this.dashboards.set(systemOverviewDashboard.id, systemOverviewDashboard);
    this.dashboards.set(walletOperationsDashboard.id, walletOperationsDashboard);

    this.logger.info('Initialized default dashboards', {
      dashboardCount: this.dashboards.size
    }, LogCategory.SYSTEM);
  }

  /**
   * Get dashboard configuration
   */
  public getDashboard(dashboardId: string): Dashboard | null {
    return this.dashboards.get(dashboardId) || null;
  }

  /**
   * Get all dashboards
   */
  public getAllDashboards(): Dashboard[] {
    return Array.from(this.dashboards.values());
  }

  /**
   * Get widget data for a specific widget
   */
  public async getWidgetData(dashboardId: string, widgetId: string): Promise<WidgetData | null> {
    const dashboard = this.getDashboard(dashboardId);
    if (!dashboard) {
      return null;
    }

    const widget = dashboard.widgets.find(w => w.id === widgetId);
    if (!widget) {
      return null;
    }

    try {
      let data: any;

      switch (widget.type) {
        case WidgetType.METRIC_CARD:
          data = await this.getMetricCardData(widget);
          break;
        
        case WidgetType.LINE_CHART:
          data = await this.getLineChartData(widget);
          break;
        
        case WidgetType.BAR_CHART:
          data = await this.getBarChartData(widget);
          break;
        
        case WidgetType.PIE_CHART:
          data = await this.getPieChartData(widget);
          break;
        
        case WidgetType.TABLE:
          data = await this.getTableData(widget);
          break;
        
        case WidgetType.ALERT_LIST:
          data = await this.getAlertListData(widget);
          break;
        
        case WidgetType.HEALTH_STATUS:
          data = await this.getHealthStatusData(widget);
          break;
        
        default:
          throw new Error(`Unknown widget type: ${widget.type}`);
      }

      return {
        widgetId,
        type: widget.type,
        data,
        lastUpdated: new Date()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to get widget data', error instanceof Error ? error : new Error(String(error)), {
        dashboardId,
        widgetId,
        widgetType: widget.type
      }, LogCategory.SYSTEM);

      return {
        widgetId,
        type: widget.type,
        data: null,
        lastUpdated: new Date(),
        error: errorMessage
      };
    }
  }

  /**
   * Get all widget data for a dashboard
   */
  public async getDashboardData(dashboardId: string): Promise<WidgetData[]> {
    const dashboard = this.getDashboard(dashboardId);
    if (!dashboard) {
      return [];
    }

    const widgetDataPromises = dashboard.widgets.map(widget =>
      this.getWidgetData(dashboardId, widget.id)
    );

    const results = await Promise.allSettled(widgetDataPromises);
    
    return results
      .map(result => result.status === 'fulfilled' ? result.value : null)
      .filter((data): data is WidgetData => data !== null);
  }

  /**
   * Get metric card data
   */
  private async getMetricCardData(widget: DashboardWidget): Promise<MetricCardData> {
    const { metric, timeRange = 24, unit } = widget.config;
    
    if (metric === 'wallet_creation_success_rate') {
      const aggregated = await metricsCollector.getAggregatedMetrics(timeRange);
      return {
        value: aggregated.walletCreationSuccessRate,
        unit: unit || '%',
        status: aggregated.walletCreationSuccessRate >= 95 ? 'healthy' : 
                aggregated.walletCreationSuccessRate >= 90 ? 'warning' : 'critical'
      };
    }

    if (metric === 'active_users') {
      const aggregated = await metricsCollector.getAggregatedMetrics(timeRange);
      return {
        value: aggregated.activeUsers,
        unit: unit || 'users'
      };
    }

    if (metric === 'wallet_operations_total') {
      const aggregated = await metricsCollector.getAggregatedMetrics(timeRange);
      return {
        value: aggregated.totalWalletOperations,
        unit: unit || 'operations'
      };
    }

    // Default metric card for any metric
    const timeSeries = await metricsCollector.getTimeSeriesData(metric, timeRange, 60);
    const latestValue = timeSeries.length > 0 ? timeSeries[timeSeries.length - 1].value : 0;
    
    return {
      value: latestValue,
      unit: unit || ''
    };
  }

  /**
   * Get line chart data
   */
  private async getLineChartData(widget: DashboardWidget): Promise<ChartSeries[]> {
    const { metric, timeRange = 24, interval = 60, labels } = widget.config;
    
    const timeSeries = await metricsCollector.getTimeSeriesData(metric, timeRange, interval, labels);
    
    return [{
      name: widget.title,
      data: timeSeries.map(point => ({
        timestamp: point.timestamp,
        value: point.value
      }))
    }];
  }

  /**
   * Get bar chart data
   */
  private async getBarChartData(widget: DashboardWidget): Promise<ChartSeries[]> {
    const { timeRange = 24 } = widget.config;
    
    if (widget.id === 'transaction-volume') {
      const aggregated = await metricsCollector.getAggregatedMetrics(timeRange);
      
      const data = Object.entries(aggregated.transactionSuccessRates).map(([type, rate]) => ({
        timestamp: new Date(),
        value: rate,
        label: type
      }));

      return [{
        name: 'Success Rate',
        data
      }];
    }

    return [];
  }

  /**
   * Get pie chart data
   */
  private async getPieChartData(widget: DashboardWidget): Promise<{ name: string; value: number }[]> {
    const { timeRange = 24 } = widget.config;
    
    if (widget.id === 'error-rates') {
      const aggregated = await metricsCollector.getAggregatedMetrics(timeRange);
      
      return Object.entries(aggregated.errorRatesByCategory).map(([category, count]) => ({
        name: category,
        value: count
      }));
    }

    return [];
  }

  /**
   * Get table data
   */
  private async getTableData(widget: DashboardWidget): Promise<{ columns: string[]; rows: TableRow[] }> {
    const { timeRange = 24 } = widget.config;
    
    if (widget.id === 'operation-success-rates') {
      const aggregated = await metricsCollector.getAggregatedMetrics(timeRange);
      
      const columns = ['Operation Type', 'Success Rate', 'Status'];
      const rows = Object.entries(aggregated.transactionSuccessRates).map(([type, rate]) => ({
        'Operation Type': type,
        'Success Rate': `${rate.toFixed(1)}%`,
        'Status': rate >= 95 ? 'Healthy' : rate >= 90 ? 'Warning' : 'Critical'
      }));

      return { columns, rows };
    }

    return { columns: [], rows: [] };
  }

  /**
   * Get alert list data
   */
  private async getAlertListData(widget: DashboardWidget): Promise<any[]> {
    const { limit = 10 } = widget.config;
    
    const alerts = await alertingService.getAlertHistory({
      limit,
      offset: 0
    });

    return alerts.map(alert => ({
      id: alert.id,
      message: alert.message,
      severity: alert.metadata?.severity || 'UNKNOWN',
      status: alert.status,
      firedAt: alert.firedAt,
      resolvedAt: alert.resolvedAt
    }));
  }

  /**
   * Get health status data
   */
  private async getHealthStatusData(widget: DashboardWidget): Promise<any> {
    const healthSummary = await healthCheckService.runAllHealthChecks();
    
    return {
      overall: healthSummary.overall,
      services: healthSummary.services.map(service => ({
        name: service.service,
        status: service.status,
        responseTime: service.responseTime,
        error: service.error
      })),
      uptime: healthSummary.uptime,
      timestamp: healthSummary.timestamp
    };
  }

  /**
   * Create a custom dashboard
   */
  public createDashboard(dashboard: Omit<Dashboard, 'createdAt' | 'updatedAt'>): Dashboard {
    const newDashboard: Dashboard = {
      ...dashboard,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.dashboards.set(newDashboard.id, newDashboard);

    this.logger.info('Created custom dashboard', {
      dashboardId: newDashboard.id,
      dashboardName: newDashboard.name,
      widgetCount: newDashboard.widgets.length
    }, LogCategory.SYSTEM);

    return newDashboard;
  }

  /**
   * Update dashboard configuration
   */
  public updateDashboard(dashboardId: string, updates: Partial<Dashboard>): Dashboard | null {
    const existingDashboard = this.dashboards.get(dashboardId);
    if (!existingDashboard) {
      return null;
    }

    const updatedDashboard: Dashboard = {
      ...existingDashboard,
      ...updates,
      updatedAt: new Date()
    };

    this.dashboards.set(dashboardId, updatedDashboard);

    this.logger.info('Updated dashboard', {
      dashboardId,
      dashboardName: updatedDashboard.name
    }, LogCategory.SYSTEM);

    return updatedDashboard;
  }

  /**
   * Delete a dashboard
   */
  public deleteDashboard(dashboardId: string): boolean {
    const deleted = this.dashboards.delete(dashboardId);
    
    if (deleted) {
      this.logger.info('Deleted dashboard', { dashboardId }, LogCategory.SYSTEM);
    }
    
    return deleted;
  }

  /**
   * Export dashboard configuration
   */
  public exportDashboard(dashboardId: string): Dashboard | null {
    return this.getDashboard(dashboardId);
  }

  /**
   * Import dashboard configuration
   */
  public importDashboard(dashboard: Dashboard): void {
    this.dashboards.set(dashboard.id, dashboard);
    
    this.logger.info('Imported dashboard', {
      dashboardId: dashboard.id,
      dashboardName: dashboard.name
    }, LogCategory.SYSTEM);
  }

  /**
   * Get dashboard performance metrics
   */
  public async getDashboardMetrics(): Promise<{
    totalDashboards: number;
    totalWidgets: number;
    averageRefreshInterval: number;
    mostUsedWidgetTypes: { type: WidgetType; count: number }[];
  }> {
    const dashboards = Array.from(this.dashboards.values());
    const totalDashboards = dashboards.length;
    const totalWidgets = dashboards.reduce((sum, dashboard) => sum + dashboard.widgets.length, 0);
    const averageRefreshInterval = dashboards.reduce((sum, dashboard) => sum + dashboard.refreshInterval, 0) / totalDashboards;

    // Count widget types
    const widgetTypeCounts = new Map<WidgetType, number>();
    dashboards.forEach(dashboard => {
      dashboard.widgets.forEach(widget => {
        const count = widgetTypeCounts.get(widget.type) || 0;
        widgetTypeCounts.set(widget.type, count + 1);
      });
    });

    const mostUsedWidgetTypes = Array.from(widgetTypeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalDashboards,
      totalWidgets,
      averageRefreshInterval,
      mostUsedWidgetTypes
    };
  }
}

// Export singleton instance
export const dashboardService = DashboardService.getInstance();