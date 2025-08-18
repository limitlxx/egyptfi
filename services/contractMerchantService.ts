// services/contractMerchantService.ts
import { Contract } from "starknet";
import { EGYPTFI_ABI } from "@/lib/abi";
import { EGYPT_SEPOLIA_CONTRACT_ADDRESS } from "@/lib/utils";

export interface ContractMerchant {
  id: string;
  business_name: string;
  businessName?: string;
  business_email: string;
  businessEmail?: string;
  created_at: string;
  is_active: boolean;
  name: string;
  email: string;
  usdc_balance: bigint;
  total_payments_received: bigint;
  total_payments_count: bigint;
  withdrawal_address: string;
  fee_percentage: number;
  joined_timestamp: bigint;
  apikeys?: APIKeyEntry[]
  createdAt: string;
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


export interface MerchantCheckResult {
  exists: boolean;
  merchant?: ContractMerchant;
  error?: string;
  
}

class ContractMerchantService {
  private contract: Contract;

  constructor(provider: any) {
    this.contract = new Contract(EGYPTFI_ABI, EGYPT_SEPOLIA_CONTRACT_ADDRESS, provider);
  }

  async getMerchant(merchantAddress: string): Promise<MerchantCheckResult> {
    try {
      console.log("Checking merchant on contract:", merchantAddress);
      
      const result = await this.contract.get_merchant(merchantAddress);
      
      console.log("Contract response:", result);

      // Check if merchant exists (is_active or has been registered)
      const isActive = result.is_active;
      const hasName = result.name && result.name !== "0x0";
      const hasEmail = result.email && result.email !== "0x0";
      
      const exists = isActive || hasName || hasEmail;

      if (exists) {
        const merchant: ContractMerchant = {
          is_active: isActive,
          name: result.name,
          email: result.email,
          usdc_balance: result.usdc_balance,
          total_payments_received: result.total_payments_received,
          total_payments_count: result.total_payments_count,
          withdrawal_address: result.withdrawal_address,
          fee_percentage: Number(result.fee_percentage),
          joined_timestamp: result.joined_timestamp,
          id: "",
          business_name: "",
          business_email: "",
          created_at: "",
          createdAt: ""
        };

        return {
          exists: true,
          merchant,
        };
      }

      return {
        exists: false,
      };
    } catch (error) {
      console.error("Error checking merchant on contract:", error);
      
      // If the error is due to merchant not being found, return exists: false
      if (error instanceof Error && error.message.includes("not found")) {
        return {
          exists: false,
        };
      }

      return {
        exists: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async verifyMerchantRegistration(merchantAddress: string): Promise<boolean> {
    try {
      const result = await this.getMerchant(merchantAddress);
      return result.exists && result.merchant?.is_active === true;
    } catch (error) {
      console.error("Error verifying merchant registration:", error);
      return false;
    }
  }
}

export default ContractMerchantService;