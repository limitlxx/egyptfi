import { useState, useEffect, useCallback } from 'react';

interface AccountDeploymentStatus {
  isDeployed: boolean;
  isLoading: boolean;
  error: string | null;
  checkDeployment: (address: string, network?: 'sepolia' | 'mainnet') => Promise<void>;
  retryDeploymentCheck: () => void;
}

export const useAccountDeployment = (
  address?: string, 
  network: 'sepolia' | 'mainnet' = 'sepolia',
  autoCheck = true
): AccountDeploymentStatus => {
  const [isDeployed, setIsDeployed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckedAddress, setLastCheckedAddress] = useState<string | null>(null);

  const checkDeployment = useCallback(async (
    checkAddress: string, 
    checkNetwork: 'sepolia' | 'mainnet' = network
  ) => {
    if (!checkAddress) {
      setError('No address provided');
      setIsDeployed(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const endpoint = `/api/proxy/avnu?address=${encodeURIComponent(checkAddress)}&network=${checkNetwork}`;
      
      console.log(`Checking account deployment: ${endpoint}`);
      
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to check account deployment: ${response.status}`);
      }

      console.log('Account deployment check result:', data);
      
      if (data.success) {
        setIsDeployed(data.data.isCompatible || false);
        setLastCheckedAddress(checkAddress);
      } else {
        setIsDeployed(false);
        setError(data.error || 'Account not deployed or not compatible with paymaster');
        setLastCheckedAddress(checkAddress);
      }
    } catch (err) {
      console.error('Error checking account deployment:', err);
      setError(err instanceof Error ? err.message : 'Network error while checking account deployment');
      setIsDeployed(false);
      setLastCheckedAddress(checkAddress);
    } finally {
      setIsLoading(false);
    }
  }, [network]);

  const retryDeploymentCheck = useCallback(() => {
    if (address) {
      checkDeployment(address, network);
    }
  }, [address, network, checkDeployment]);

  // Auto-check when address changes
  useEffect(() => {
    if (autoCheck && address && address !== lastCheckedAddress) {
      checkDeployment(address, network);
    }
  }, [address, network, autoCheck, checkDeployment, lastCheckedAddress]);

  // Reset state when address changes
  useEffect(() => {
    if (address !== lastCheckedAddress) {
      setIsDeployed(false);
      setError(null);
    }
  }, [address, lastCheckedAddress]);

  return {
    isDeployed,
    isLoading,
    error,
    checkDeployment,
    retryDeploymentCheck,
  };
};