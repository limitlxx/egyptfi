import { AuthManager } from "@/lib/auth-utils";
import { useWithdrawMerchantCalls } from "@/hooks/useWithdrawMerchantCalls";
import { usePaymaster } from "@/hooks/usePayMaster";
import { toast } from "@/hooks/use-toast";
import ContractMerchantService from "@/services/contractMerchantService";
import { useProvider } from "@starknet-react/core";

export interface Withdrawal {
  id?: string;
  to_address: string;
  currency_amount: number; // Fiat amount (e.g., USD)
  wallet_amount: number; // USDC amount
  status: "pending" | "completed" | "failed";
  txHash?: string;
  gasSponsored?: boolean;
  created_at: string; // ISO timestamp
}

export class WithdrawalService {
  static async createWithdrawal({
    merchantWallet,
    amount,
    executeWithdraw,
    calls,
    paymentMode,
  }: {
    merchantWallet: string;
    amount: string; // Human-readable USDC amount (e.g., "10.5")
    executeWithdraw: () => Promise<any>;
    calls?: any[]; // StarkNet Call array
    paymentMode: "sponsored" | "default" | "unknown";
  }): Promise<Withdrawal> {
    if (!calls || !calls.length) {
      throw new Error("Invalid withdrawal transaction data");
    }

    const amountNum = parseFloat(amount);
    if (amountNum <= 0) {
      throw new Error("Withdrawal amount must be greater than 0");
    }

    // Fetch merchant's withdrawal address
    const { provider } = useProvider();
    const contractService = new ContractMerchantService(provider);
    const merchantData = await contractService.getMerchant(merchantWallet);
    const toAddress = merchantData?.merchant?.withdrawal_address;
    if (!toAddress) {
      throw new Error("Merchant withdrawal address not found");
    }

    try {
      // Execute on-chain withdrawal
      const txResult = await executeWithdraw();
      const transactionHash = txResult?.transaction_hash;

      if (!transactionHash) {
        throw new Error("Transaction failed: No transaction hash returned");
      }

      // Record withdrawal in database
      const response = await AuthManager.makeAuthenticatedRequest(
        "/api/merchants/transactions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currency_amount: amountNum, // Assume USD for simplicity (modify if fiat conversion needed)
            wallet_amount: amountNum, // USDC amount
            to_address: toAddress,
            status: "pending",
            txHash: transactionHash,
            gasSponsored: paymentMode === "sponsored",
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to record withdrawal");
      }

      const withdrawalData = await response.json();
      return {
        id: withdrawalData.transaction.id,
        to_address: toAddress,
        currency_amount: amountNum,
        wallet_amount: amountNum,
        status: "pending",
        txHash: transactionHash,
        gasSponsored: paymentMode === "sponsored",
        created_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Withdrawal creation failed:", error);
      throw error;
    }
  }
}