// services/merchantRegistrationService.ts
import { truncateToFelt252, emailToFelt252 } from "@/lib/felt252-utils";
import ContractMerchantService from './contractMerchantService';

export interface MerchantRegistrationData {
  business_name: string;
  business_email: string;
  business_type: string;
  monthly_volume: string;
  wallet_address?: string;
  authMethod: 'wallet' | 'google';
  local_currency?: string;
}

export interface ApiKeys {
  testnet: {
    publicKey: string;
    secretKey: string;
    jwt: string;
  };
  mainnet: {
    publicKey: string;
    secretKey: string;
    jwt: string;
  };
}

export interface RegistrationResult {
  success: boolean;
  merchant?: any;
  apiKeys?: ApiKeys;
  error?: string;
  requiresContractRegistration?: any;
}

export interface ContractRegistrationData {
  nameAsFelt: string;
  emailAsFelt: string;
  withdrawalAddress: string;
  feePercentage: number;
}

class MerchantRegistrationService {
  // Prepare data for contract registration
  static prepareContractData(
    merchantData: MerchantRegistrationData,
    walletAddress: string
  ): ContractRegistrationData {
    try {
      const nameAsFelt = truncateToFelt252(merchantData.business_name);
      const emailAsFelt = emailToFelt252(merchantData.business_email);
      const withdrawalAddress = walletAddress;
      const feePercentage = 50; // 0.5% as basis points (50/10000 = 0.5%)

      return {
        nameAsFelt,
        emailAsFelt,
        withdrawalAddress,
        feePercentage
      };
    } catch (error) {
      throw new Error(`Failed to prepare contract data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Register merchant in database
  static async registerInDatabase(merchantData: MerchantRegistrationData): Promise<RegistrationResult> {
    try {
      console.log('Registering merchant in database:', merchantData);
      
      const response = await fetch('/api/merchants/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(merchantData),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('Database registration successful:', data);
        return {
          success: true,
          merchant: data.merchant,
          apiKeys: data.apiKeys,
          requiresContractRegistration: merchantData.authMethod === 'wallet' && merchantData.wallet_address,
        };
      } else {
        return {
          success: false,
          error: data.error || 'Failed to register in database',
        };
      }
    } catch (error) {
      console.error('Database registration error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Database registration failed',
      };
    }
  }

  // Verify contract registration was successful
  static async verifyContractRegistration(
    walletAddress: string,
    provider: any,
    maxRetries: number = 5,
    retryDelay: number = 2000
  ): Promise<boolean> {
    const contractService = new ContractMerchantService(provider);
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`Verifying contract registration attempt ${i + 1}/${maxRetries}`);
        
        const isRegistered = await contractService.verifyMerchantRegistration(walletAddress);
        
        if (isRegistered) {
          console.log('Contract registration verified successfully');
          return true;
        }
        
        if (i < maxRetries - 1) {
          console.log(`Registration not yet confirmed, retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      } catch (error) {
        console.error(`Verification attempt ${i + 1} failed:`, error);
        
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    console.error('Contract registration verification failed after all retries');
    return false;
  }

  // Update merchant status after successful contract registration
  static async updateMerchantContractStatus(
    merchantId: string,
    contractData: any
  ): Promise<boolean> {
    try {
      const response = await fetch('/api/merchants/update-contract-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          merchantId,
          contractRegistered: true,
          contractData,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('Merchant contract status updated successfully');
        return true;
      } else {
        console.error('Failed to update merchant contract status:', data.error);
        return false;
      }
    } catch (error) {
      console.error('Error updating merchant contract status:', error);
      return false;
    }
  }

  // Store sensitive data securely (implement based on your security requirements)
  static storeApiKeys(apiKeys: ApiKeys): void {
    // In production, consider using a more secure storage method
    localStorage.setItem('testnet_keys', JSON.stringify({
      publicKey: apiKeys.testnet.publicKey,
      jwt: apiKeys.testnet.jwt
    }));
    
    localStorage.setItem('mainnet_keys', JSON.stringify({
      publicKey: apiKeys.mainnet.publicKey,
      jwt: apiKeys.mainnet.jwt
    }));

    // Log secret keys for the user to store securely
    console.warn('IMPORTANT - Store these secret keys securely:', {
      testnet: apiKeys.testnet.secretKey,
      mainnet: apiKeys.mainnet.secretKey
    });
  }

  static storeMerchantData(merchant: any): void {
    localStorage.setItem('merchant', JSON.stringify(merchant));
  }
}

export default MerchantRegistrationService;