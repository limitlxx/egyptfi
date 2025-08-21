import { useState, useCallback, useEffect, useRef } from 'react';
import { useProvider } from '@starknet-react/core';
import MerchantRegistrationService, {
  MerchantRegistrationData,
  RegistrationResult,
  ContractRegistrationData,
} from '@/services/merchantRegistrationService';
import { useRegisterMerchantCalls } from './useRegisterMerchantCalls';
import { usePaymaster } from './usePayMaster';
import toast from 'react-hot-toast';
import { Call } from 'starknet';

interface MerchantRegistrationState {
  isRegistering: boolean;
  isContractRegistering: boolean;
  isVerifying: boolean;
  registrationStep: 'idle' | 'database' | 'contract' | 'verification' | 'complete';
  dbResult: RegistrationResult | null;
  contractData: ContractRegistrationData | null;
  pendingMerchantData: MerchantRegistrationData | null;
  error: string | null;
}

interface UseMerchantRegistrationResult extends MerchantRegistrationState {
  registerMerchant: (
    data: MerchantRegistrationData,
    walletAddress?: string,
    isDeployed?: boolean
  ) => Promise<boolean>;
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
    pendingMerchantData: null,
    error: null,
  });

  const { provider } = useProvider();
  const callsRef = useRef<Call[] | undefined>(undefined);

  const { calls, isReady, contractData: preparedContractData } = useRegisterMerchantCalls({
    merchantData: state.pendingMerchantData,
    walletAddress: state.contractData?.withdrawalAddress,
    enabled: !!(state.contractData && state.pendingMerchantData),
  });

  useEffect(() => {
    callsRef.current = calls;
    console.log('Updated callsRef:', { calls, isReady, merchantData: state.pendingMerchantData, walletAddress: state.contractData?.withdrawalAddress });
  }, [calls, isReady, state.pendingMerchantData, state.contractData]);

  const {
    executeTransaction,
    isLoading: isTransactionLoading,
    isSuccess: isTransactionSuccess,
    transactionHash,
    txError,
    errorEstimate,
    errorSend,
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

  const handleContractRegistrationSuccess = useCallback(
    async (hash: string) => {
      setState((prev) => ({
        ...prev,
        isContractRegistering: false,
        isVerifying: true,
        registrationStep: 'verification',
      }));

      toast.success('Contract registration successful! Creating account...', {
        id: 'registration',
      });

      try {
        if (!state.contractData || !state.pendingMerchantData) {
          throw new Error('Missing contract or merchant data for verification');
        }

        const isVerified = await MerchantRegistrationService.verifyContractRegistration(
          state.contractData.withdrawalAddress,
          provider
        );

        if (!isVerified) {
          throw new Error('Contract registration could not be verified on blockchain');
        }

        setState((prev) => ({
          ...prev,
          registrationStep: 'database',
        }));

        toast.loading('Creating account in database...', {
          id: 'registration',
        });

        const merchantDataWithTx = {
          ...state.pendingMerchantData,
          transaction_hash: hash,
        };

        const dbResult = await MerchantRegistrationService.registerInDatabase(merchantDataWithTx);

        if (!dbResult.success) {
          console.error(
            'CRITICAL: Contract registration succeeded but database registration failed',
            {
              transactionHash: hash,
              contractData: state.contractData,
              merchantData: state.pendingMerchantData,
              dbError: dbResult.error,
            }
          );
          throw new Error(dbResult.error || 'Database registration failed');
        }

        MerchantRegistrationService.storeMerchantData(dbResult.merchant!);
        if (dbResult.apiKeys) {
          MerchantRegistrationService.storeApiKeys(dbResult.apiKeys);
        }

        setState((prev) => ({
          ...prev,
          isVerifying: false,
          registrationStep: 'complete',
          dbResult,
        }));

        toast.success('Account created successfully!', { id: 'registration' });
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isVerifying: false,
          error: error instanceof Error ? error.message : 'Verification or database registration failed',
          registrationStep: 'idle',
        }));
        toast.error(
          error instanceof Error ? error.message : 'Registration failed after contract success',
          { id: 'registration' }
        );
      }
    },
    [state.contractData, state.pendingMerchantData, provider]
  );

  const handleContractRegistrationError = useCallback((error: any) => {
    setState((prev) => ({
      ...prev,
      isContractRegistering: false,
      error: error instanceof Error ? error.message : 'Contract registration failed',
      registrationStep: 'idle',
    }));
    if (error instanceof Error && error.message.includes('User rejected the transaction')) {
      toast.error('Please approve the transaction to complete registration', { id: 'registration' });
    } else {
      toast.error('Contract registration failed', { id: 'registration' });
    }
  }, []);

  const registerMerchant = useCallback(
    async (
      data: MerchantRegistrationData,
      walletAddress?: string,
      isDeployed?: boolean
    ): Promise<boolean> => {
      console.log('registerMerchant called with:', { data, walletAddress, isDeployed });

      setState((prev) => ({
        ...prev,
        isRegistering: true,
        error: null,
        registrationStep: 'idle',
      }));

      try {
        if (data.authMethod === 'wallet' && (!walletAddress || !isDeployed)) {
          throw new Error('Wallet address and deployment status required for wallet auth');
        }

        // Check if merchant is already registered
        const merchantCheck = await MerchantRegistrationService.verifyContractRegistration(walletAddress!, provider);
        if (merchantCheck) {
          throw new Error('Merchant already registered on the blockchain');
        }

        const requiresContractRegistration = data.authMethod === 'wallet' && walletAddress && isDeployed;

        if (requiresContractRegistration) {
          const contractData = MerchantRegistrationService.prepareContractData(data, walletAddress);

          setState((prev) => ({
            ...prev,
            registrationStep: 'contract',
            isContractRegistering: true,
            contractData,
            pendingMerchantData: data,
          }));

          await new Promise((resolve) => setTimeout(resolve, 200));

          console.log('After state update:', { calls: callsRef.current, isReady, contractData, merchantData: data });

          let transactionCalls = callsRef.current;
          if (!isReady && data && walletAddress) {
            console.warn('isReady is false, recomputing calls as fallback');
            const { calls: fallbackCalls } = useRegisterMerchantCalls({
              merchantData: data,
              walletAddress,
              enabled: true,
            });
            transactionCalls = fallbackCalls;
            console.log('Fallback calls:', transactionCalls);
          }

          if (!transactionCalls || transactionCalls.length === 0) {
            throw new Error(`Transaction calls not ready: isReady=${isReady}, calls=${JSON.stringify(transactionCalls)}`);
          }

          await executeTransaction(transactionCalls);

          return true;
        } else {
          setState((prev) => ({
            ...prev,
            registrationStep: 'database',
          }));

          toast.loading('Creating account...', { id: 'registration' });

          const dbResult = await MerchantRegistrationService.registerInDatabase(data);

          if (!dbResult.success) {
            throw new Error(dbResult.error || 'Database registration failed');
          }

          MerchantRegistrationService.storeMerchantData(dbResult.merchant!);
          if (dbResult.apiKeys) {
            MerchantRegistrationService.storeApiKeys(dbResult.apiKeys);
          }

          setState((prev) => ({
            ...prev,
            isRegistering: false,
            registrationStep: 'complete',
            dbResult,
          }));

          toast.success('Account created successfully!', { id: 'registration' });
          return true;
        }
      } catch (error) {
        console.error('Registration error:', error);
        setState((prev) => ({
          ...prev,
          isRegistering: false,
          isContractRegistering: false,
          error: error instanceof Error ? error.message : 'Registration failed',
          registrationStep: 'idle',
        }));
        if (error instanceof Error && error.message.includes('User rejected the transaction')) {
          toast.error('Please approve the transaction to complete registration', { id: 'registration' });
        } else {
          toast.error(error instanceof Error ? error.message : 'Registration failed', { id: 'registration' });
        }
        return false;
      }
    },
    [executeTransaction, provider]
  );

  const resetRegistration = useCallback(() => {
    console.log('resetRegistration called');
    setState({
      isRegistering: false,
      isContractRegistering: false,
      isVerifying: false,
      registrationStep: 'idle',
      dbResult: null,
      contractData: null,
      pendingMerchantData: null,
      error: null,
    });
    callsRef.current = undefined;
  }, []);

  return {
    ...state,
    isContractRegistering: state.isContractRegistering || isTransactionLoading,
    registerMerchant,
    resetRegistration,
  };
};