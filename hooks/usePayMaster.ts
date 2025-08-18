import { useMemo, useEffect, useState } from "react";
import {
  usePaymasterEstimateFees,
  usePaymasterSendTransaction,
  useTransactionReceipt,
  useSendTransaction,
} from "@starknet-react/core";
import { Call, FeeMode } from "starknet";
import { usePaymasterCredits } from "./usePaymasterCredits";
import toast from "react-hot-toast";

interface UsePaymasterOptions {
  calls?: Call[];
  enabled?: boolean;
  onSuccess?: (transactionHash: string) => void;
  onError?: (error: any) => void;
  forceMode?: "sponsored" | "default"; // Allow forcing a specific mode
}

export const usePaymaster = ({
  calls: initialCalls,
  enabled = true,
  onSuccess,
  onError,
  forceMode,
}: UsePaymasterOptions) => {
  const [paymentMode, setPaymentMode] = useState<
    "sponsored" | "default" | "unknown"
  >("unknown");

  // Monitor paymaster credits
  const { shouldUseFreeMode, getCreditsStatus, checkCredits } =
    usePaymasterCredits();

  // Determine the payment mode
  const actualMode = useMemo(() => {
    if (forceMode) return forceMode;
    return shouldUseFreeMode ? "default" : "sponsored";
  }, [forceMode, shouldUseFreeMode]);

  const feeMode: FeeMode = useMemo(() => {
    if (actualMode === "sponsored") {
      return { mode: "sponsored" };
    } else {
      // For default mode, we need to specify a gas token
      return { 
        mode: "default",
        gasToken: "0x04718f5a0Fc34cC1AF16A1cdee98fFB20C31f5cD61D6Ab07201858f4287c938D" // STRK SEPOLIA token address
      };
    }
  }, [actualMode]);

  // Update payment mode when it changes
  useEffect(() => {
    setPaymentMode(actualMode);
  }, [actualMode]);

  // Gas estimation (only for sponsored mode)
  const {
    data: estimateData,
    isPending: isPendingEstimate,
    error: errorEstimate,
  } = usePaymasterEstimateFees({
    calls: initialCalls,
    options: { feeMode },
  });

  // Sponsored transaction sending
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

  // Free transaction sending (user pays gas)
  const {
    sendAsync: sendFree,
    data: freeData,
    isPending: isPendingFree,
    error: errorFree,
  } = useSendTransaction({
    calls: initialCalls,
  });

  // Determine which data to use based on mode
  const sendData = actualMode === "sponsored" ? sponsoredData : freeData;
  const isPendingSend =
    actualMode === "sponsored" ? isPendingSponsored : isPendingFree;
  const errorSend = actualMode === "sponsored" ? errorSponsored : errorFree;

  // Transaction receipt
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

  // Execute transaction with automatic mode selection
  const executeTransaction = async (runtimeCalls?: Call[]) => {
    const txCalls = runtimeCalls ?? initialCalls;
    console.log("txCall", txCalls);
    
    if (!txCalls || !enabled) {
      throw new Error("Transaction not ready or disabled");
    }

    try {
      // Check credits before executing sponsored transaction
      if (actualMode === "sponsored") {
        await checkCredits();

        // If credits are exhausted after check, show warning and switch to free mode
        if (shouldUseFreeMode) {
          toast.error(
            "Paymaster credits exhausted. Transaction will use free mode (you'll pay gas fees)."
          );
          setPaymentMode("default");
          const result = await sendFree(txCalls);
          return result;
        }

        toast.success("Transaction sponsored - no gas fees for you!");
        const result = await sendSponsored(txCalls);
        return result;
      } else {
        toast.error(
          "Using free mode - you'll pay the gas fees with your preferred token."
        );
        const result = await sendFree(txCalls);
        return result;
      }
    } catch (error) {
      // If sponsored transaction fails, try free mode as fallback
      if (actualMode === "sponsored" && !forceMode) {
        console.warn(
          "Sponsored transaction failed, falling back to free mode:",
          error
        );
        toast.error("Sponsored transaction failed. Trying free mode...");

        try {
          setPaymentMode("default");
          const result = await sendFree(txCalls);
          toast.success("Transaction completed in free mode.");
          return result;
        } catch (fallbackError) {
          onError?.(fallbackError);
          throw fallbackError;
        }
      }

      onError?.(error);
      throw error;
    }
  };

  // Computed states
  const isSuccess = txStatus === "success" && waitData;
  const isError =
    txStatus === "error" || isTxError || errorSend || errorEstimate;

  // Callbacks
  if (isSuccess && onSuccess && sendData?.transaction_hash) {
    onSuccess(sendData.transaction_hash);
  }
  if (isError && onError) {
    onError(txError || errorSend || errorEstimate);
  }

  return {
    // Estimation
    estimateData,
    isPendingEstimate,
    errorEstimate,

    // Transaction
    executeTransaction,
    sendData,
    isPendingSend,
    errorSend,

    // Receipt
    waitIsLoading,
    waitData,
    txStatus,
    isTxError,
    txError,

    // Computed states
    isLoading: isPendingEstimate || isPendingSend || waitIsLoading,
    isSuccess,
    isError,
    transactionHash: sendData?.transaction_hash,

    // Payment mode info
    paymentMode,
    creditsStatus: getCreditsStatus(),
    shouldUseFreeMode,

    // Fee mode
    feeMode,
  };
};
