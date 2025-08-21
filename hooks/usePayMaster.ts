import { useMemo, useEffect, useState } from 'react';
import {
  usePaymasterEstimateFees,
  usePaymasterSendTransaction,
  useTransactionReceipt,
  useSendTransaction,
} from '@starknet-react/core';
import { Call, FeeMode } from 'starknet';
import { usePaymasterCredits } from './usePaymasterCredits';
import toast from 'react-hot-toast';

interface UsePaymasterOptions {
  calls?: Call[];
  enabled?: boolean;
  onSuccess?: (transactionHash: string) => void;
  onError?: (error: any) => void;
  forceMode?: 'sponsored' | 'default';
}

export const usePaymaster = ({
  calls: initialCalls,
  enabled = true,
  onSuccess,
  onError,
  forceMode,
}: UsePaymasterOptions) => {
  const [paymentMode, setPaymentMode] = useState<'sponsored' | 'default' | 'unknown'>('unknown');

  const { shouldUseFreeMode, getCreditsStatus, checkCredits } = usePaymasterCredits();

  const actualMode = useMemo(() => {
    if (forceMode) return forceMode;
    return shouldUseFreeMode ? 'default' : 'sponsored';
  }, [forceMode, shouldUseFreeMode]);

  const feeMode: FeeMode = useMemo(() => {
    if (actualMode === 'sponsored') {
      return { mode: 'sponsored' };
    } else {
      return {
        mode: 'default',
        gasToken: '0x04718f5a0Fc34cC1AF16A1cdee98fFB20C31f5cD61D6Ab07201858f4287c938D', // STRK SEPOLIA
      };
    }
  }, [actualMode]);

  useEffect(() => {
    setPaymentMode(actualMode);
  }, [actualMode]);

  const {
    data: estimateData,
    isPending: isPendingEstimate,
    error: errorEstimate,
  } = usePaymasterEstimateFees({
    calls: initialCalls,
    options: { feeMode },
  });

  const {
    sendAsync: sendSponsored,
    data: sponsoredData,
    isPending: isPendingSponsored,
    error: errorSponsored,
  } = usePaymasterSendTransaction({
    calls: initialCalls,
    options: { feeMode },
    maxFeeInGasToken: estimateData?.suggested_max_fee_in_gas_token,
  });

  const {
    sendAsync: sendFree,
    data: freeData,
    isPending: isPendingFree,
    error: errorFree,
  } = useSendTransaction({
    calls: initialCalls,
  });

  const sendData = actualMode === 'sponsored' ? sponsoredData : freeData;
  const isPendingSend = actualMode === 'sponsored' ? isPendingSponsored : isPendingFree;
  const errorSend = actualMode === 'sponsored' ? errorSponsored : errorFree;

  const {
    isLoading: waitIsLoading,
    data: waitData,
    status: txStatus,
    isError: isTxError,
    error: txError,
  } = useTransactionReceipt({
    hash: sendData?.transaction_hash,
    watch: true,
  });

  const executeTransaction = async (runtimeCalls?: Call[]) => {
    const txCalls = runtimeCalls ?? initialCalls;
    console.log('executeTransaction called with:', {
      txCalls,
      initialCalls,
      enabled,
      paymentMode,
      feeMode,
    });

    if (!txCalls || txCalls.length === 0 || !enabled) {
      const errorMsg = `Invalid transaction calls or disabled: calls=${JSON.stringify(txCalls)}, initialCalls=${JSON.stringify(initialCalls)}, enabled=${enabled}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      if (actualMode === 'sponsored') {
        await checkCredits();
        if (shouldUseFreeMode) {
          toast.error('Paymaster credits exhausted. Switching to free mode.');
          setPaymentMode('default');
          try {
            const result = await sendFree(txCalls);
            return result;
          } catch (freeError) {
            if (freeError instanceof Error && freeError.message.includes('User rejected request')) {
              console.warn('User rejected free mode transaction:', freeError);
              toast.error('Transaction rejected. Please approve the transaction to continue.', { id: 'transaction-rejected' });
              throw new Error('User rejected the transaction');
            }
            throw freeError;
          }
        }

        toast.success('Transaction sponsored - no gas fees!');
        const result = await sendSponsored(txCalls);
        return result;
      } else {
        toast.error('Using free mode - you pay gas fees.');
        try {
          const result = await sendFree(txCalls);
          return result;
        } catch (freeError) {
          if (freeError instanceof Error && freeError.message.includes('User rejected request')) {
            console.warn('User rejected free mode transaction:', freeError);
            toast.error('Transaction rejected. Please approve the transaction to continue.', { id: 'transaction-rejected' });
            throw new Error('User rejected the transaction');
          }
          throw freeError;
        }
      }
    } catch (error) {
      if (actualMode === 'sponsored' && !forceMode) {
        console.warn('Sponsored transaction failed, falling back to free mode:', error);
        toast.error('Sponsored transaction failed. Trying free mode...');
        try {
          setPaymentMode('default');
          const result = await sendFree(txCalls);
          toast.success('Transaction completed in free mode.');
          return result;
        } catch (fallbackError) {
          if (fallbackError instanceof Error && fallbackError.message.includes('User rejected request')) {
            console.warn('User rejected fallback transaction:', fallbackError);
            toast.error('Transaction rejected. Please approve the transaction to continue.', { id: 'transaction-rejected' });
            throw new Error('User rejected the transaction');
          }
          console.error('Free mode transaction failed:', fallbackError);
          onError?.(fallbackError);
          throw fallbackError;
        }
      }
      console.error('Transaction error:', error);
      onError?.(error);
      throw error;
    }
  };

  const isSuccess = txStatus === 'success' && waitData;
  const isError = txStatus === 'error' || isTxError || errorSend || errorEstimate;

  if (isSuccess && onSuccess && sendData?.transaction_hash) {
    onSuccess(sendData.transaction_hash);
  }
  if (isError && onError) {
    onError(txError || errorSend || errorEstimate);
  }

  return {
    estimateData,
    isPendingEstimate,
    errorEstimate,
    executeTransaction,
    sendData,
    isPendingSend,
    errorSend,
    waitIsLoading,
    waitData,
    txStatus,
    isTxError,
    txError,
    isLoading: isPendingEstimate || isPendingSend || waitIsLoading,
    isSuccess,
    isError,
    transactionHash: sendData?.transaction_hash,
    paymentMode,
    creditsStatus: getCreditsStatus(),
    shouldUseFreeMode,
    feeMode,
  };
};