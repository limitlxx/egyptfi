// services/contractMerchantService.ts
import { Contract } from "starknet";
import { EGYPTFI_ABI } from "@/lib/abi";
import { EGYPT_SEPOLIA_CONTRACT_ADDRESS } from "@/lib/utils";
import { chipipayService } from "./chipipayService";
import { ContractCallParams } from "./types/chipipay.types";

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
  apikeys?: APIKeyEntry[];
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

export interface ContractRegistrationParams {
  walletAddress: string;
  encryptedPrivateKey: string;
  metadataHash: string;
  bearerToken: string;
  encryptKey: string; // PIN to decrypt the private key
}

class ContractMerchantService {
  private contract: Contract;
  private contractAddress: string;

  constructor(provider: any, contractAddress?: string) {
    this.contractAddress = contractAddress || EGYPT_SEPOLIA_CONTRACT_ADDRESS;
    this.contract = new Contract({
      abi: EGYPTFI_ABI,
      address: this.contractAddress,
    });
    this.contract.connect(provider);
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
          createdAt: "",
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

  // Register merchant using ChipiPay invisible wallet
  // async registerMerchantWithChipiPay(
  //   params: ContractRegistrationParams
  // ): Promise<string> {
  //   try {
  //     console.log("Registering merchant on contract via ChipiPay:", {
  //       walletAddress: params.walletAddress,
  //       contractAddress: this.contractAddress,
  //     });

  //     const contractCallParams: ContractCallParams = {
  //       privateKey: params.encryptedPrivateKey,
  //       contractAddress: this.contractAddress,
  //       entrypoint: "register_merchant",
  //       calldata: [
  //         params.walletAddress, // withdrawal_address
  //         params.metadataHash, // metadata_hash
  //       ],
  //       bearerToken: params.bearerToken,
  //       encryptKey: params.encryptKey,
  //       walletPublicKey: params.walletAddress,
  //     };

  //     const result = await chipipayService.callAnyContract(contractCallParams);

  //     if (!result.success) {
  //       throw new Error(result.error || "Contract registration failed");
  //     }

  //     console.log("Merchant registered on contract successfully:", {
  //       txHash: result.txHash,
  //       walletAddress: params.walletAddress,
  //     });

  //     return result.txHash;
  //   } catch (error) {
  //     console.error("Error registering merchant via ChipiPay:", error);
  //     throw new Error(
  //       `Failed to register merchant on contract: ${
  //         error instanceof Error ? error.message : "Unknown error"
  //       }`
  //     );
  //   }
  // }

  // // Update merchant withdrawal address using ChipiPay
  // async updateWithdrawalAddress(
  //   encryptedPrivateKey: string,
  //   walletPublicKey: string,
  //   newWithdrawalAddress: string,
  //   encryptKey: string,
  //   bearerToken: string
  // ): Promise<string> {
  //   try {
  //     const contractCallParams: ContractCallParams = {
  //       privateKey: encryptedPrivateKey,
  //       contractAddress: this.contractAddress,
  //       entrypoint: "update_merchant_withdrawal_address",
  //       calldata: [newWithdrawalAddress],
  //       bearerToken,
  //       encryptKey,
  //       walletPublicKey,
  //     };

  //     const result = await chipipayService.callAnyContract(contractCallParams);

  //     if (!result.success) {
  //       throw new Error(result.error || "Failed to update withdrawal address");
  //     }

  //     return result.txHash;
  //   } catch (error) {
  //     console.error("Error updating withdrawal address:", error);
  //     throw error;
  //   }
  // }

  // Update merchant metadata using ChipiPay
  // async updateMerchantMetadata(
  //   encryptedPrivateKey: string,
  //   walletPublicKey: string,
  //   newMetadataHash: string,
  //   encryptKey: string,
  //   bearerToken: string
  // ): Promise<string> {
  //   try {
  //     const contractCallParams: ContractCallParams = {
  //       privateKey: encryptedPrivateKey,
  //       contractAddress: this.contractAddress,
  //       entrypoint: "update_merchant_metadata",
  //       calldata: [newMetadataHash],
  //       bearerToken,
  //       encryptKey,
  //       walletPublicKey,
  //     };

  //     const result = await chipipayService.callAnyContract(contractCallParams);

  //     if (!result.success) {
  //       throw new Error(result.error || "Failed to update metadata");
  //     }

  //     return result.txHash;
  //   } catch (error) {
  //     console.error("Error updating merchant metadata:", error);
  //     throw error;
  //   }
  // }

  // Set KYC proof on-chain (mock implementation for now)
  async setKycProof(
    encryptedPrivateKey: string,
    walletPublicKey: string,
    proofHash: string,
    encryptKey: string,
    bearerToken: string
  ): Promise<string> {
    try {
      console.log("Setting KYC proof on-chain (mock):", {
        walletPublicKey,
        proofHash,
        contractAddress: this.contractAddress,
      });

      // Mock implementation - in production, this would make an actual contract call
      // For now, we'll simulate a successful transaction
      const mockTxHash = `0x${Math.random().toString(16).substr(2, 64)}`;

      console.log("KYC proof set on-chain successfully (mock):", {
        txHash: mockTxHash,
        walletPublicKey,
        proofHash,
      });

      return mockTxHash;
    } catch (error) {
      console.error("Error setting KYC proof on-chain:", error);
      throw new Error(
        `Failed to set KYC proof: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Get KYC proof from contract
  async getKycProof(merchantAddress: string): Promise<string> {
    try {
      console.log("Getting KYC proof from contract:", merchantAddress);

      const result = await this.contract.get_kyc_proof(merchantAddress);

      console.log("KYC proof retrieved:", result);
      return result.toString();
    } catch (error) {
      console.error("Error getting KYC proof:", error);
      return "0"; // Return "0" if no proof exists
    }
  }

  // Verify KYC proof on-chain
  async verifyKycProof(merchantAddress: string, proofHash: string): Promise<boolean> {
    try {
      console.log("Verifying KYC proof on-chain:", {
        merchantAddress,
        proofHash,
      });

      const result = await this.contract.verify_kyc_proof(merchantAddress, proofHash);

      console.log("KYC proof verification result:", result);
      return result;
    } catch (error) {
      console.error("Error verifying KYC proof:", error);
      return false;
    }
  }

  // // Withdraw funds using ChipiPay
  // async withdrawFunds(
  //   encryptedPrivateKey: string,
  //   walletPublicKey: string,
  //   amount: string,
  //   encryptKey: string,
  //   bearerToken: string
  // ): Promise<string> {
  //   try {
  //     const contractCallParams: ContractCallParams = {
  //       privateKey: encryptedPrivateKey,
  //       contractAddress: this.contractAddress,
  //       entrypoint: "withdraw_funds",
  //       calldata: [amount],
  //       bearerToken,
  //       encryptKey,
  //       walletPublicKey,
  //     };

  //     const result = await chipipayService.callAnyContract(contractCallParams);

  //     if (!result.success) {
  //       throw new Error(result.error || "Failed to withdraw funds");
  //     }

  //     return result.txHash;
  //   } catch (error) {
  //     console.error("Error withdrawing funds:", error);
  //     throw error;
  //   }
  // }
}

export default ContractMerchantService;
