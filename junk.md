// hooks/useMerchantRegistration.ts
import { useState, useCallback } from 'react';
import { useProvider } from "@starknet-react/core";
import MerchantRegistrationService, {
  MerchantRegistrationData,
  RegistrationResult,
  ContractRegistrationData
} from '@/services/merchantRegistrationService';
import { useRegisterMerchantCalls } from './useRegisterMerchantCalls';
import { usePaymaster } from './usePayMaster';
import toast from 'react-hot-toast';

interface MerchantRegistrationState {
  isRegistering: boolean;
  isContractRegistering: boolean;
  isVerifying: boolean;
  registrationStep: 'idle' | 'database' | 'contract' | 'verification' | 'complete';
  dbResult: RegistrationResult | null;
  contractData: ContractRegistrationData | null;
  error: string | null;
}

interface UseMerchantRegistrationResult extends MerchantRegistrationState {
  registerMerchant: (data: MerchantRegistrationData, walletAddress?: string, isDeployed?: boolean) => Promise<boolean>;
  resetRegistration: () => void;
}

export const useMerchantRegistration = (): UseMerchantRegistrationResult => {
  const [state, setState] = useState<MerchantRegistrationState>({
    isRegistering: false,
    isContractRegistering: false,
    isVerifying: false,
    registrationStep: 'idle',
    dbResult: null,
    contractData: null,
    error: null,
  });

  const { provider } = useProvider();

  // Prepare contract registration calls
  console.log("Add Merchant Contract Call");

  const { calls, isReady } = useRegisterMerchantCalls({
    merchantData: state.dbResult?.merchant,
    walletAddress: state.contractData?.withdrawalAddress,
    enabled: !!(state.contractData && state.dbResult?.merchant),
  });

  // Handle paymaster transaction
  const {
    executeTransaction,
    isLoading: isTransactionLoading,
    isSuccess: isTransactionSuccess,
    transactionHash,
    txError,
  } = usePaymaster({
    calls,
    enabled: isReady,
    onSuccess: (hash: string) => {
      console.log('Contract registration transaction successful:', hash);
      handleContractRegistrationSuccess(hash);
    },
    onError: (error: any) => {
      console.error('Contract registration transaction failed:', error);
      handleContractRegistrationError(error);
    },
  });

  const handleContractRegistrationSuccess = useCallback(async (hash: string) => {
    setState(prev => ({
      ...prev,
      isContractRegistering: false,
      isVerifying: true,
      registrationStep: 'verification',
    }));

    toast.success('Contract registration transaction submitted!');

    try {
      // Step 2: Register in database after successful contract registration
      const dbResult = await MerchantRegistrationService.registerInDatabase(state.contractData!.merchantData);
      if (!dbResult.success) {
          throw new Error(dbResult.error || 'Database registration failed after contract registration');
      }

      // Store merchant data and API keys
      MerchantRegistrationService.storeMerchantData(dbResult.merchant!);
      if (dbResult.apiKeys) {
        MerchantRegistrationService.storeApiKeys(dbResult.apiKeys);
      }

      // Step 3: Update merchant status in database with contract data
      await MerchantRegistrationService.updateMerchantContractStatus(
        dbResult.merchant!.id,
        {
          transactionHash: hash,
          contractData: state.contractData,
        }
      );

      setState(prev => ({
        ...prev,
        isVerifying: false,
        dbResult, // Save the result for potential future use
        registrationStep: 'complete',
      }));

      toast.success('Registration complete! Redirecting to dashboard...');
      return true;

    } catch (error) {
      setState(prev => ({
        ...prev,
        isVerifying: false,
        error: error instanceof Error ? error.message : 'Database registration failed after contract registration',
        registrationStep: 'idle',
      }));
      toast.error('Registration verification failed');
      return false;
    }
  }, [state.contractData, provider]);

  const handleContractRegistrationError = useCallback((error: any) => {
    setState(prev => ({
      ...prev,
      isContractRegistering: false,
      error: error instanceof Error ? error.message : 'Contract registration failed',
      registrationStep: 'idle',
    }));
    toast.error('Contract registration failed');
  }, []);

  const registerMerchant = useCallback(async (
    data: MerchantRegistrationData,
    walletAddress?: string,
    isDeployed?: boolean
  ): Promise<boolean> => {
    setState(prev => ({
      ...prev,
      isRegistering: true,
      registrationStep: 'contract',
      error: null,
    }));

    try {
      // Step 1: If wallet registration and deployed, proceed with contract registration
      if (data.authMethod === 'wallet' && walletAddress && isDeployed) {
        toast.loading('Registering on blockchain...', { id: 'registration' });

        // Prepare contract data
        const contractData = MerchantRegistrationService.prepareContractData(data, walletAddress);

        setState(prev => ({
          ...prev,
          contractData,
        }));

        // Execute contract registration
        await executeTransaction();

        // The success/error handling will be done in the callbacks
        return true;
      } else {
        // Handle cases where contract registration is not needed or wallet is not deployed
        toast.loading('Creating account...', { id: 'registration' });
        const dbResult = await MerchantRegistrationService.registerInDatabase(data);

        if (!dbResult.success) {
            throw new Error(dbResult.error || 'Database registration failed');
        }

        setState(prev => ({
            ...prev,
            isRegistering: false,
            dbResult,
            registrationStep: 'complete',
        }));

        // Store merchant data and API keys
        MerchantRegistrationService.storeMerchantData(dbResult.merchant!);
        if (dbResult.apiKeys) {
            MerchantRegistrationService.storeApiKeys(dbResult.apiKeys);
        }

        if (data.authMethod === 'wallet' && walletAddress && !isDeployed) {
          toast.success('Account created! (Blockchain registration skipped - wallet not deployed)', { id: 'registration' });
        } else {
          toast.success('Account created successfully!', { id: 'registration' });
        }
        return true;
      }
    } catch (error) {
      console.error('Registration error:', error);

      setState(prev => ({
        ...prev,
        isRegistering: false,
        error: error instanceof Error ? error.message : 'Registration failed',
        registrationStep: 'idle',
      }));

      toast.error(error instanceof Error ? error.message : 'Registration failed', { id: 'registration' });
      return false;
    }
  }, [executeTransaction]);

  const resetRegistration = useCallback(() => {
    setState({
      isRegistering: false,
      isContractRegistering: false,
      isVerifying: false,
      registrationStep: 'idle',
      dbResult: null,
      contractData: null,
      error: null,
    });
  }, []);

  return {
    ...state,
    isContractRegistering: state.isContractRegistering || isTransactionLoading,
    registerMerchant,
    resetRegistration,
  };
};