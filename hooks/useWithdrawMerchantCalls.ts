// hooks/useWithdrawMerchantCalls.ts
import { useMemo } from 'react';
import { useContract } from "@starknet-react/core";
import { EGYPTFI_ABI } from "@/lib/abi";
import { EGYPT_SEPOLIA_CONTRACT_ADDRESS } from "@/lib/utils";
import { uint256 } from "starknet";

interface UseWithdrawMerchantCallsOptions {
  amount?: string; // Human-readable amount (e.g., "10.5" for 10.5 USDC)
  enabled?: boolean;
}

export const useWithdrawMerchantCalls = ({
  amount,
  enabled = true,
}: UseWithdrawMerchantCallsOptions) => {
  const { contract } = useContract({
    abi: EGYPTFI_ABI,
    address: EGYPT_SEPOLIA_CONTRACT_ADDRESS,
  });

  const calls = useMemo(() => {
    if (!contract || !amount || !enabled) {
      return undefined;
    }
    
    try {
      // Convert human-readable amount to raw u256 (assuming 6 decimals for USDC)
      const rawAmount = BigInt(Math.floor(parseFloat(amount) * 10 ** 6));
      const withdrawAmount = uint256.bnToUint256(rawAmount);

      console.log("Preparing withdraw call with amount:", amount, "raw:", withdrawAmount);

      return [contract.populate("withdraw_funds", [withdrawAmount])];
    } catch (error) {
      console.error("Error preparing withdraw calls:", error);
      return undefined;
    }
  }, [contract, amount, enabled]);

  return {
    calls,
    isReady: !!calls,
  };
};