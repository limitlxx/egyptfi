// hooks/useNetworkStatus.ts
import { useState, useEffect, useCallback } from 'react';

interface NetworkStatus {
  isOnline: boolean;
  isSlowConnection: boolean;
  connectionType: string | null;
  lastChecked: Date | null;
  latency: number | null;
}

export function useNetworkStatus() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true, isSlowConnection: false,
    connectionType: null,
    lastChecked: null,
    latency: null,
  });

  const [isChecking, setIsChecking] = useState(false);

  // Check connection speed by making a small request
  const checkConnectionSpeed = useCallback(async (): Promise<{ latency: number; isSlowConnection: boolean }> => {
    const startTime = performance.now();
    
    try {
      // Use a small image or endpoint to test connection speed
      const response = await fetch('/favicon.ico', { 
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      const endTime = performance.now();
      const latency = endTime - startTime;
      
      // Consider connection slow if latency > 2 seconds or if response is not ok
      const isSlowConnection = latency > 2000 || !response.ok;
      
      return { latency, isSlowConnection };
    } catch (error) {
      console.warn('Network speed check failed:', error);
      return { latency: -1, isSlowConnection: true };
    }
  }, []);

  // Manual network check function
  const checkNetworkStatus = useCallback(async () => {
    setIsChecking(true);
    
    try {
      const { latency, isSlowConnection } = await checkConnectionSpeed();
      
      // Get connection type if available
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      const connectionType = connection?.effectiveType || connection?.type || null;
      
      setNetworkStatus({
        isOnline: navigator.onLine && latency !== -1,
        isSlowConnection,
        connectionType,
        lastChecked: new Date(),
        latency: latency > 0 ? latency : null,
      });
    } catch (error) {
      console.error('Network status check failed:', error);
      setNetworkStatus(prev => ({
        ...prev,
        isOnline: false,
        isSlowConnection: true,
        lastChecked: new Date(),
      }));
    } finally {
      setIsChecking(false);
    }
  }, [checkConnectionSpeed]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setNetworkStatus(prev => ({ ...prev, isOnline: true }));
      checkNetworkStatus(); // Recheck speed when coming back online
    };

    const handleOffline = () => {
      setNetworkStatus(prev => ({ 
        ...prev, 
        isOnline: false, 
        isSlowConnection: true,
        lastChecked: new Date()
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (navigator.onLine) {
      checkNetworkStatus();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkNetworkStatus]);

  return {
    ...networkStatus,
    isChecking,
    checkNetworkStatus,
    // Helper functions
    getConnectionQuality: () => {
      if (!networkStatus.isOnline) return 'offline';
      if (networkStatus.isSlowConnection) return 'slow';
      if (networkStatus.latency && networkStatus.latency < 500) return 'fast';
      return 'normal';
    },
    getStatusMessage: () => {
      if (!networkStatus.isOnline) return 'No internet connection';
      if (networkStatus.isSlowConnection) return 'Slow internet connection detected';
      return 'Connection is stable';
    }
  };
}