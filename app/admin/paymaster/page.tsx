"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  DollarSign,
  Zap,
  Activity,
  CreditCard
} from "lucide-react";
import { usePaymasterCredits } from "@/hooks/usePaymasterCredits";

export default function PaymasterAdminPage() {
  const { 
    activity, 
    isLoading, 
    error, 
    lastChecked, 
    hasCredits, 
    hasStrkCredits, 
    shouldUseFreeMode,
    checkCredits,
    getCreditsStatus 
  } = usePaymasterCredits();

  const formatEth = (value: string) => {
    const num = parseFloat(value);
    return num.toFixed(6);
  };

  const formatStrk = (value: string) => {
    const num = parseFloat(value);
    return num.toFixed(2);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sufficient': return 'text-green-600 bg-green-50 border-green-200';
      case 'low': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'exhausted': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sufficient': return <CheckCircle className="w-5 h-5" />;
      case 'low': return <AlertTriangle className="w-5 h-5" />;
      case 'exhausted': return <AlertTriangle className="w-5 h-5" />;
      default: return <Activity className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Paymaster Dashboard</h1>
              <p className="text-gray-600">Monitor gas sponsorship activity and credits</p>
            </div>
            <div className="flex items-center space-x-4">
              {lastChecked && (
                <span className="text-sm text-gray-500">
                  Last updated: {lastChecked.toLocaleTimeString()}
                </span>
              )}
              <Button
                onClick={checkCredits}
                disabled={isLoading}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Credits Status Overview */}
        <div className="mb-8">
          <div className={`p-6 rounded-lg border-2 ${getStatusColor(getCreditsStatus())}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getStatusIcon(getCreditsStatus())}
                <div>
                  <h2 className="text-xl font-semibold">
                    Credits Status: {getCreditsStatus().charAt(0).toUpperCase() + getCreditsStatus().slice(1)}
                  </h2>
                  <p className="text-sm opacity-80">
                    {shouldUseFreeMode 
                      ? "Using free mode - users will pay their own gas fees"
                      : "Sponsored mode active - gas fees are covered"
                    }
                  </p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant={shouldUseFreeMode ? "destructive" : "default"}>
                  {shouldUseFreeMode ? "Free Mode" : "Sponsored Mode"}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {activity && (
          <>
            {/* Credits Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">ETH Credits</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatEth(activity.remainingCredits)} ETH</div>
                  <p className="text-xs text-muted-foreground">
                    {hasCredits ? "Sufficient for sponsored transactions" : "Low - consider recharging"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">STRK Credits</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatStrk(activity.remainingStrkCredits)} STRK</div>
                  <p className="text-xs text-muted-foreground">
                    {hasStrkCredits ? "Sufficient for sponsored transactions" : "Low - consider recharging"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Transaction Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{activity.txCount}</div>
                  <p className="text-xs text-muted-foreground">
                    All executed transactions
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Successful</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{activity.succeededTxCount}</div>
                  <p className="text-xs text-muted-foreground">
                    {activity.txCount > 0 ? Math.round((activity.succeededTxCount / activity.txCount) * 100) : 0}% success rate
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Reverted</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{activity.revertedTxCount}</div>
                  <p className="text-xs text-muted-foreground">
                    {activity.txCount > 0 ? Math.round((activity.revertedTxCount / activity.txCount) * 100) : 0}% failure rate
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Sponsor Name</CardTitle>
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold">{activity.name}</div>
                  <p className="text-xs text-muted-foreground">
                    Paymaster account
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Gas Fees Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>ETH Gas Fees</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Spent</span>
                    <span className="font-semibold">{formatEth(activity.gasFees)} ETH</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Successful Transactions</span>
                    <span className="font-semibold text-green-600">{formatEth(activity.succeededGasFees)} ETH</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Reverted Transactions</span>
                    <span className="font-semibold text-red-600">{formatEth(activity.revertedGasFees)} ETH</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>STRK Gas Fees</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Spent</span>
                    <span className="font-semibold">{formatStrk(activity.strkGasFees)} STRK</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Successful Transactions</span>
                    <span className="font-semibold text-green-600">{formatStrk(activity.succeededStrkGasFees)} STRK</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Reverted Transactions</span>
                    <span className="font-semibold text-red-600">{formatStrk(activity.revertedStrkGasFees)} STRK</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recommendations */}
            <div className="mt-8">
              <Card>
                <CardHeader>
                  <CardTitle>Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {!hasCredits && (
                      <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg">
                        <AlertTriangle className="w-5 h-5 text-red-600 mr-3" />
                        <div>
                          <p className="font-medium text-red-800">ETH Credits Exhausted</p>
                          <p className="text-sm text-red-600">Contact AVNU to recharge your ETH credits for sponsored transactions.</p>
                        </div>
                      </div>
                    )}
                    
                    {!hasStrkCredits && (
                      <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg">
                        <AlertTriangle className="w-5 h-5 text-red-600 mr-3" />
                        <div>
                          <p className="font-medium text-red-800">STRK Credits Exhausted</p>
                          <p className="text-sm text-red-600">Contact AVNU to recharge your STRK credits for sponsored transactions.</p>
                        </div>
                      </div>
                    )}

                    {parseFloat(activity.remainingCredits) < 0.01 && hasCredits && (
                      <div className="flex items-center p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <AlertTriangle className="w-5 h-5 text-orange-600 mr-3" />
                        <div>
                          <p className="font-medium text-orange-800">Low ETH Credits</p>
                          <p className="text-sm text-orange-600">Consider recharging soon to avoid service interruption.</p>
                        </div>
                      </div>
                    )}

                    {hasCredits && hasStrkCredits && (
                      <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-lg">
                        <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                        <div>
                          <p className="font-medium text-green-800">Credits Sufficient</p>
                          <p className="text-sm text-green-600">Your paymaster is ready to sponsor user transactions.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {!activity && !isLoading && (
          <div className="text-center py-12">
            <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
            <p className="text-gray-600 mb-4">Unable to fetch paymaster activity data.</p>
            <Button onClick={checkCredits}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}