// hooks/useMerchantStatus.ts
import { useState, useEffect, useCallback } from 'react';
import { useProvider } from "@starknet-react/core";
import ContractMerchantService, { ContractMerchant, MerchantCheckResult } from '@/services/contractMerchantService';

interface DbMerchant {
  id: string;
  business_name: string;
  business_email: string;
  wallet_address: string;
  is_verified: boolean;
  created_at: string;
  businessEmail: string;
  businessName: string;
  createdAt: string;
  apikeys: APIKeyEntry[]
  // ... other db fields
}

interface APIKeyEntry {
  id: string;
  merchant_id: string;
  secret_key: string;
  environment?: "testnet" | "mainnet"; // add this if your backend supports it
  public_key?: string;
  jwt?: string;
}

interface DbMerchantCheckResult {
  exists: boolean;
  merchant?: DbMerchant;
  error?: string;
}

interface MerchantStatusResult {
  isLoading: boolean;
  contractCheck: MerchantCheckResult | null;
  dbCheck: DbMerchantCheckResult | null;
  isContractMerchant: boolean;
  isDbMerchant: boolean;
  error: string | null;
  checkMerchantStatus: (address: string) => Promise<void>;
  resetStatus: () => void;
}

export const useMerchantStatus = (): MerchantStatusResult => {
  const [isLoading, setIsLoading] = useState(false);
  const [contractCheck, setContractCheck] = useState<MerchantCheckResult | null>(null);
  const [dbCheck, setDbCheck] = useState<DbMerchantCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { provider } = useProvider();

  const checkDbMerchant = async (walletAddress: string): Promise<DbMerchantCheckResult> => {
    try {
      const response = await fetch('/api/merchants/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ walletAddress }),
      });

      const data = await response.json();

      if (response.ok) {
        return {
          exists: data.exists,
          merchant: data.merchant,
        };
      } else {
        return {
          exists: false,
          error: data.error || 'Failed to check database',
        };
      }
    } catch (error) {
      console.error('Error checking database merchant:', error);
      return {
        exists: false,
        error: error instanceof Error ? error.message : 'Database check failed',
      };
    }
  };

  const checkMerchantStatus = useCallback(async (address: string) => {
    if (!address || !provider) {
      setError('Address or provider not available');
      return;
    }

    setIsLoading(true);
    setError(null);
    setContractCheck(null);
    setDbCheck(null);

    try {
      // Step 1: Check contract first
      console.log('Step 1: Checking contract for merchant:', address);
      const contractService = new ContractMerchantService(provider);
      const contractResult = await contractService.getMerchant(address);
      
      console.log('Contract check result:', contractResult);
      setContractCheck(contractResult);

      // Step 2: Check database
      console.log('Step 2: Checking database for merchant:', address);
      const dbResult = await checkDbMerchant(address);
      
      console.log('Database check result:', dbResult);
      setDbCheck(dbResult);

    } catch (error) {
      console.error('Error in merchant status check:', error);
      setError(error instanceof Error ? error.message : 'Failed to check merchant status');
    } finally {
      setIsLoading(false);
    }
  }, [provider]);

  const resetStatus = useCallback(() => {
    setContractCheck(null);
    setDbCheck(null);
    setError(null);
    setIsLoading(false);
  }, []);

  const isContractMerchant = contractCheck?.exists === true;
  const isDbMerchant = dbCheck?.exists === true;

  return {
    isLoading,
    contractCheck,
    dbCheck,
    isContractMerchant,
    isDbMerchant,
    error,
    checkMerchantStatus,
    resetStatus,
  };
};