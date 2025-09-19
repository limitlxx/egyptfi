/**
 * Dashboard API endpoint
 * Provides access to dashboard configurations and data
 */

import { NextRequest, NextResponse } from "next/server";
import { dashboardService } from "../../../lib/dashboard";
import { Logger, LogCategory } from "../../../lib/logging";
import { metricsCollector } from "../../../lib/metrics";
import { AuthMiddleware } from "../../../lib/auth-middleware";

const logger = Logger.createWithCorrelationId("dashboard-api");

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Apply authentication middleware
    const authResult = await AuthMiddleware.validateApiKey(
      request.headers.get("x-api-key") || ""
    );
    if (!authResult.success) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check rate limiting
    if (!authResult.merchant) {
      return NextResponse.json(
        { error: "Invalid merchant data" },
        { status: 401 }
      );
    }

    const rateLimit = AuthMiddleware.checkRateLimit(
      authResult.merchant.merchantId
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          resetTime: rateLimit.resetTime,
        },
        { status: 429 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const dashboardId = searchParams.get("id");
    const widgetId = searchParams.get("widget");
    const action = searchParams.get("action") || "list";

    let responseData;

    switch (action) {
      case "list":
        // Get all dashboards
        responseData = dashboardService.getAllDashboards().map((dashboard) => ({
          id: dashboard.id,
          name: dashboard.name,
          description: dashboard.description,
          widgetCount: dashboard.widgets.length,
          refreshInterval: dashboard.refreshInterval,
          createdAt: dashboard.createdAt,
          updatedAt: dashboard.updatedAt,
        }));
        break;

      case "get":
        if (!dashboardId) {
          return NextResponse.json(
            { error: "Dashboard ID required" },
            { status: 400 }
          );
        }

        const dashboard = dashboardService.getDashboard(dashboardId);
        if (!dashboard) {
          return NextResponse.json(
            { error: "Dashboard not found" },
            { status: 404 }
          );
        }

        responseData = dashboard;
        break;

      case "data":
        if (!dashboardId) {
          return NextResponse.json(
            { error: "Dashboard ID required" },
            { status: 400 }
          );
        }

        if (widgetId) {
          // Get specific widget data
          const widgetData = await dashboardService.getWidgetData(
            dashboardId,
            widgetId
          );
          if (!widgetData) {
            return NextResponse.json(
              { error: "Widget not found" },
              { status: 404 }
            );
          }
          responseData = widgetData;
        } else {
          // Get all dashboard data
          responseData = await dashboardService.getDashboardData(dashboardId);
        }
        break;

      case "metrics":
        // Get dashboard performance metrics
        responseData = await dashboardService.getDashboardMetrics();
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
      "GET",
      "/api/dashboard",
      200,
      responseTime,
      authResult.merchant.merchantId
    );

    logger.info(
      "Dashboard API request completed",
      {
        action,
        dashboardId,
        widgetId,
        responseTime,
        merchantId: authResult.merchant.merchantId,
      },
      LogCategory.API_REQUEST
    );

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        "Cache-Control":
          action === "data" ? "public, max-age=30" : "public, max-age=300",
        "X-Response-Time": `${responseTime}ms`,
      },
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error(
      "Dashboard API error",
      error instanceof Error ? error : new Error(String(error)),
      {
        responseTime,
      },
      LogCategory.API_REQUEST
    );

    // Record error metrics
    metricsCollector.recordApiRequest(
      "GET",
      "/api/dashboard",
      500,
      responseTime
    );

    return NextResponse.json(
      {
        error: "Internal server error",
        timestamp: new Date().toISOString(),
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
      request.headers.get("x-api-key") || ""
    );
    if (!authResult.success) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check rate limiting
    if (!authResult.merchant) {
      return NextResponse.json(
        { error: "Invalid merchant data" },
        { status: 401 }
      );
    }

    const rateLimit = AuthMiddleware.checkRateLimit(
      authResult.merchant.merchantId
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          resetTime: rateLimit.resetTime,
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { action } = body;

    let responseData;

    switch (action) {
      case "create":
        const { dashboard } = body;
        if (!dashboard || !dashboard.id || !dashboard.name) {
          return NextResponse.json(
            { error: "Invalid dashboard configuration" },
            { status: 400 }
          );
        }

        responseData = dashboardService.createDashboard(dashboard);
        break;

      case "update":
        const { dashboardId, updates } = body;
        if (!dashboardId || !updates) {
          return NextResponse.json(
            { error: "Dashboard ID and updates required" },
            { status: 400 }
          );
        }

        responseData = dashboardService.updateDashboard(dashboardId, updates);
        if (!responseData) {
          return NextResponse.json(
            { error: "Dashboard not found" },
            { status: 404 }
          );
        }
        break;

      case "import":
        const { dashboardConfig } = body;
        if (!dashboardConfig) {
          return NextResponse.json(
            { error: "Dashboard configuration required" },
            { status: 400 }
          );
        }

        dashboardService.importDashboard(dashboardConfig);
        responseData = {
          success: true,
          message: "Dashboard imported successfully",
        };
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
      "POST",
      "/api/dashboard",
      200,
      responseTime,
      authResult.merchant.merchantId
    );

    logger.info(
      "Dashboard API POST request completed",
      {
        action,
        responseTime,
        merchantId: authResult.merchant.merchantId,
      },
      LogCategory.API_REQUEST
    );

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        "X-Response-Time": `${responseTime}ms`,
      },
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error(
      "Dashboard API POST error",
      error instanceof Error ? error : new Error(String(error)),
      {
        responseTime,
      },
      LogCategory.API_REQUEST
    );

    // Record error metrics
    metricsCollector.recordApiRequest(
      "POST",
      "/api/dashboard",
      500,
      responseTime
    );

    return NextResponse.json(
      {
        error: "Internal server error",
        timestamp: new Date().toISOString(),
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
      request.headers.get("x-api-key") || ""
    );
    if (!authResult.success) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check rate limiting
    if (!authResult.merchant) {
      return NextResponse.json(
        { error: "Invalid merchant data" },
        { status: 401 }
      );
    }

    const rateLimit = AuthMiddleware.checkRateLimit(
      authResult.merchant.merchantId
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          resetTime: rateLimit.resetTime,
        },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const dashboardId = searchParams.get("id");

    if (!dashboardId) {
      return NextResponse.json(
        { error: "Dashboard ID required" },
        { status: 400 }
      );
    }

    const deleted = dashboardService.deleteDashboard(dashboardId);

    if (!deleted) {
      return NextResponse.json(
        { error: "Dashboard not found" },
        { status: 404 }
      );
    }

    const responseTime = Date.now() - startTime;

    // Record metrics
    metricsCollector.recordApiRequest(
      "DELETE",
      "/api/dashboard",
      200,
      responseTime,
      authResult.merchant.merchantId
    );

    logger.info(
      "Dashboard deleted",
      {
        dashboardId,
        responseTime,
        merchantId: authResult.merchant.merchantId,
      },
      LogCategory.API_REQUEST
    );

    return NextResponse.json(
      { success: true, message: "Dashboard deleted successfully" },
      {
        status: 200,
        headers: {
          "X-Response-Time": `${responseTime}ms`,
        },
      }
    );
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error(
      "Dashboard API DELETE error",
      error instanceof Error ? error : new Error(String(error)),
      {
        responseTime,
      },
      LogCategory.API_REQUEST
    );

    // Record error metrics
    metricsCollector.recordApiRequest(
      "DELETE",
      "/api/dashboard",
      500,
      responseTime
    );

    return NextResponse.json(
      {
        error: "Internal server error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
