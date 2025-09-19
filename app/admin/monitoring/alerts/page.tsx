'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Bell, 
  Plus, 
  Settings, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  RefreshCw
} from 'lucide-react';

// Types
interface AlertRule {
  id: number;
  name: string;
  description: string;
  metricName: string;
  conditionType: string;
  thresholdValue: number;
  comparisonOperator: string;
  timeWindowMinutes: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AlertHistory {
  id: number;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'ACTIVE' | 'RESOLVED' | 'ACKNOWLEDGED';
  firedAt: string;
  resolvedAt?: string;
}

export default function AlertsManagement() {
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [alertHistory, setAlertHistory] = useState<AlertHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch alert rules
  const fetchAlertRules = async () => {
    try {
      const response = await fetch('/api/alerts?type=rules');
      if (!response.ok) throw new Error('Failed to fetch alert rules');
      const data = await response.json();
      setAlertRules(data);
    } catch (err) {
      console.error('Error fetching alert rules:', err);
      setError('Failed to load alert rules');
    }
  };

  // Fetch alert history
  const fetchAlertHistory = async () => {
    try {
      const response = await fetch('/api/alerts?type=history&limit=20');
      if (!response.ok) throw new Error('Failed to fetch alert history');
      const data = await response.json();
      setAlertHistory(data);
    } catch (err) {
      console.error('Error fetching alert history:', err);
      setError('Failed to load alert history');
    }
  };

  // Acknowledge alert
  const acknowledgeAlert = async (alertId: number) => {
    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'acknowledge',
          alertId
        })
      });

      if (!response.ok) throw new Error('Failed to acknowledge alert');
      
      // Refresh alert history
      await fetchAlertHistory();
    } catch (err) {
      console.error('Error acknowledging alert:', err);
      setError('Failed to acknowledge alert');
    }
  };

  // Refresh all data
  const refreshData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        fetchAlertRules(),
        fetchAlertHistory()
      ]);
    } catch (err) {
      console.error('Error refreshing data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'LOW': return 'bg-blue-100 text-blue-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'HIGH': return 'bg-orange-100 text-orange-800';
      case 'CRITICAL': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-red-100 text-red-800';
      case 'ACKNOWLEDGED': return 'bg-yellow-100 text-yellow-800';
      case 'RESOLVED': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span>Loading alerts...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center space-x-2">
            <Bell className="h-8 w-8" />
            <span>Alert Management</span>
          </h1>
          <p className="text-gray-600">
            Configure and manage system alerts and notifications
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={refreshData} disabled={loading} size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Alert Rule
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Alert Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Alert Rules</span>
            <Badge variant="outline">{alertRules.length}</Badge>
          </CardTitle>
          <CardDescription>
            Configure conditions that trigger alerts when system metrics exceed thresholds
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alertRules.length === 0 ? (
            <div className="text-center py-8">
              <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Alert Rules Configured
              </h3>
              <p className="text-gray-600 mb-4">
                Create alert rules to monitor system health and performance
              </p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create First Alert Rule
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {alertRules.map((rule) => (
                <div key={rule.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-medium">{rule.name}</h4>
                        <Badge className={getSeverityColor(rule.severity)}>
                          {rule.severity}
                        </Badge>
                        <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                          {rule.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{rule.description}</p>
                      <div className="text-xs text-gray-500 space-y-1">
                        <div>Metric: {rule.metricName}</div>
                        <div>
                          Condition: {rule.conditionType} {rule.comparisonOperator} {rule.thresholdValue}
                        </div>
                        <div>Time Window: {rule.timeWindowMinutes} minutes</div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline">
                        Edit
                      </Button>
                      <Button size="sm" variant="outline">
                        {rule.enabled ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alert History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Recent Alerts</span>
            <Badge variant="outline">{alertHistory.length}</Badge>
          </CardTitle>
          <CardDescription>
            History of fired alerts and their current status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alertHistory.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Recent Alerts
              </h3>
              <p className="text-gray-600">
                All systems are operating normally
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {alertHistory.map((alert) => (
                <div key={alert.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge className={getSeverityColor(alert.severity)}>
                          {alert.severity}
                        </Badge>
                        <Badge className={getStatusColor(alert.status)}>
                          {alert.status}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium mb-1">{alert.message}</p>
                      <div className="text-xs text-gray-500 space-y-1">
                        <div>Fired: {new Date(alert.firedAt).toLocaleString()}</div>
                        {alert.resolvedAt && (
                          <div>Resolved: {new Date(alert.resolvedAt).toLocaleString()}</div>
                        )}
                      </div>
                    </div>
                    {alert.status === 'ACTIVE' && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => acknowledgeAlert(alert.id)}
                      >
                        Acknowledge
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}