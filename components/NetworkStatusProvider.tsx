// components/NetworkStatusProvider.tsx
"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { AlertTriangle, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface NetworkStatusContextType {
  isOnline: boolean;
  isSlowConnection: boolean;
  connectionType: string | null;
  lastChecked: Date | null;
  latency: number | null;
  isChecking: boolean;
  checkNetworkStatus: () => Promise<void>;
  getConnectionQuality: () => string;
  getStatusMessage: () => string;
}

const NetworkStatusContext = createContext<
  NetworkStatusContextType | undefined
>(undefined);

export function useGlobalNetworkStatus() {
  const context = useContext(NetworkStatusContext);
  if (context === undefined) {
    throw new Error(
      "useGlobalNetworkStatus must be used within a NetworkStatusProvider"
    );
  }
  return context;
}

interface NetworkStatusProviderProps {
  children: ReactNode;
  showGlobalIndicator?: boolean;
}

export function NetworkStatusProvider({
  children,
  showGlobalIndicator = true,
}: NetworkStatusProviderProps) {
  const networkStatus = useNetworkStatus();

  return (
    <NetworkStatusContext.Provider value={networkStatus}>
      {children}

      {/* Global Network Status Indicator */}
      {showGlobalIndicator &&
        (!networkStatus.isOnline || networkStatus.isSlowConnection) && (
          <div className="fixed bottom-4 right-4 z-50 max-w-sm">
            <Alert
              className={`${
                !networkStatus.isOnline
                  ? "border-red-200 bg-red-50"
                  : "border-orange-200 bg-orange-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  {!networkStatus.isOnline ? (
                    <WifiOff className="h-4 w-4 text-red-600 mr-2" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-orange-600 mr-2" />
                  )}
                  <AlertDescription
                    className={`text-sm ${
                      !networkStatus.isOnline
                        ? "text-red-800"
                        : "text-orange-800"
                    }`}
                  >
                    {networkStatus.getStatusMessage()}
                  </AlertDescription>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={networkStatus.checkNetworkStatus}
                  disabled={networkStatus.isChecking}
                  className="ml-2 h-6 w-6 p-0"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${
                      networkStatus.isChecking ? "animate-spin" : ""
                    } ${
                      !networkStatus.isOnline
                        ? "text-red-600"
                        : "text-orange-600"
                    }`}
                  />
                </Button>
              </div>
            </Alert>
          </div>
        )}
    </NetworkStatusContext.Provider>
  );
}

// Network Status Component for inline use
interface NetworkStatusIndicatorProps {
  showDetails?: boolean;
  className?: string;
}

export function NetworkStatusIndicator({
  showDetails = false,
  className = "",
}: NetworkStatusIndicatorProps) {
  const networkStatus = useGlobalNetworkStatus();

  if (networkStatus.isOnline && !networkStatus.isSlowConnection) {
    return null; // Don't show anything when connection is good
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {!networkStatus.isOnline ? (
        <WifiOff className="h-4 w-4 text-red-600" />
      ) : (
        <Wifi className="h-4 w-4 text-orange-600" />
      )}

      <span
        className={`text-sm ${
          !networkStatus.isOnline ? "text-red-600" : "text-orange-600"
        }`}
      >
        {networkStatus.getStatusMessage()}
      </span>

      {showDetails && networkStatus.latency && (
        <span className="text-xs text-gray-500">
          ({Math.round(networkStatus.latency)}ms)
        </span>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={networkStatus.checkNetworkStatus}
        disabled={networkStatus.isChecking}
        className="h-6 w-6 p-0"
      >
        <RefreshCw
          className={`h-3 w-3 ${
            networkStatus.isChecking ? "animate-spin" : ""
          }`}
        />
      </Button>
    </div>
  );
}
