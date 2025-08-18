import { AuthManager } from "@/lib/auth-utils";

export interface Withdrawal {
   id: string
  amount: string
  status: string
  txHash: string
  date: string
  gasSponsored: boolean
  total_payments: string
  current_month_payments: string  
}

/**
 * Service class for API key operations
 */
export class WithdrawalService {
  static async getWithdrawals(): Promise<Withdrawal[]> {
    const response = await AuthManager.makeAuthenticatedRequest("/api/merchants/transactions");

    if (!response.ok) {
      throw new Error(`Failed to fetch API keys: ${response.statusText}`);
    }

    return response.json();
  }

  static async getWithdrawalstats(): Promise<any> {
    const response = await AuthManager.makeAuthenticatedRequest(`/api/merchants/transactions?stats=true`);

    if (!response.ok) {
      throw new Error(`Failed to fetch API keys: ${response.statusText}`);
    }

    return response.json();
  }

  static async createWithdrawal(WithdrawalData: Partial<Withdrawal>): Promise<Withdrawal> {
    const response = await AuthManager.makeAuthenticatedRequest("/api/merchants/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(WithdrawalData),
    });

    if (!response.ok) {
      throw new Error(`Failed to create API key: ${response.statusText}`);
    }

    const { Withdrawal } = await response.json();
    return Withdrawal;
  } 
}
