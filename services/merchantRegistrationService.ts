// services/merchantRegistrationService.ts
import { truncateToFelt252, emailToFelt252 } from "@/lib/felt252-utils";
import ContractMerchantService from './contractMerchantService';
import { chipipayService } from './chipipayService';
import { CreateWalletParams, CreateWalletResponse, ContractCallParams } from './types/chipipay.types';
import { AuthManager } from "@/lib/auth-utils";

export interface MerchantRegistrationData {
  business_name: string;
  business_email: string;
  business_type: string;
  monthly_volume: string;
  wallet_address?: string;
  authMethod: 'wallet' | 'google';
  local_currency?: string;
  encryptKey?: string; // PIN for wallet encryption
  externalUserId?: string; // User ID from auth provider
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
  wallet?: {
    publicKey: string;
    encryptedPrivateKey: string;
  };
  walletTxHash?: string;
  contractRegistrationTxHash?: string;
}

export interface ContractRegistrationData {
  nameAsFelt: string;
  emailAsFelt: string;
  withdrawalAddress: string;
  feePercentage: number;
}

class MerchantRegistrationService {
  // Create ChipiPay invisible wallet
  static async createInvisibleWallet(
    merchantData: MerchantRegistrationData,
    bearerToken: string,
    apiPublicKey: string
  ): Promise<CreateWalletResponse> {
    try {
      if (!merchantData.encryptKey || !merchantData.externalUserId) {
        throw new Error('encryptKey and externalUserId are required for wallet creation');
      }

      console.log('Creating invisible wallet for merchant:', merchantData.business_email);

      const walletParams: CreateWalletParams = {
        encryptKey: merchantData.encryptKey,
        externalUserId: merchantData.externalUserId,
        apiPublicKey,
        bearerToken
      };

      const walletResult = await chipipayService.createWallet(walletParams);

      if (!walletResult.success) {
        throw new Error('Failed to create invisible wallet');
      }

      console.log('Invisible wallet created successfully:', {
        publicKey: walletResult.wallet.publicKey,
        txHash: walletResult.txHash
      });

      return walletResult;
    } catch (error) {
      console.error('Error creating invisible wallet:', error);
      throw new Error(`Failed to create invisible wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Register merchant on the contract using ChipiPay
  static async registerMerchantOnContract(
    merchantData: MerchantRegistrationData,
    walletAddress: string,
    encryptedPrivateKey: string,
    bearerToken: string,
    contractAddress: string
  ): Promise<string> {
    try {
      console.log('Registering merchant on contract:', {
        walletAddress,
        contractAddress,
        businessName: merchantData.business_name
      });

      // Prepare metadata hash (combining name and email as felt252)
      const nameAsFelt = truncateToFelt252(merchantData.business_name);
      const emailAsFelt = emailToFelt252(merchantData.business_email);
      
      // For simplicity, we'll use the name as metadata_hash
      // In production, you might want to create a proper hash of all metadata
      const metadataHash = nameAsFelt;

      if (!merchantData.encryptKey) {
        throw new Error('encryptKey (PIN) is required for contract registration');
      }

      // ChipiPay expects the encrypted private key and PIN to decrypt it
      const contractCallParams: ContractCallParams = {
        privateKey: encryptedPrivateKey, // This is the encrypted private key from ChipiPay
        contractAddress,
        entrypoint: 'register_merchant',
        calldata: [
          walletAddress, // withdrawal_address
          metadataHash   // metadata_hash
        ],
        bearerToken,
        encryptKey: merchantData.encryptKey, // PIN to decrypt the private key
        walletPublicKey: walletAddress // Public key of the wallet
      };

      const result = await chipipayService.callAnyContract(contractCallParams);

      if (!result.success) {
        throw new Error(result.error || 'Contract registration failed');
      }

      console.log('Merchant registered on contract successfully:', {
        txHash: result.txHash,
        walletAddress
      });

      return result.txHash;
    } catch (error) {
      console.error('Error registering merchant on contract:', error);
      throw new Error(`Failed to register merchant on contract: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

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

  // Complete merchant registration with invisible wallet
  static async registerMerchantWithInvisibleWallet(
    merchantData: MerchantRegistrationData,
    bearerToken: string,
    apiPublicKey: string,
    contractAddress: string
  ): Promise<RegistrationResult> {
    try {
      console.log('Starting complete merchant registration with invisible wallet');

      // Step 1: Create invisible wallet
      const walletResult = await this.createInvisibleWallet(
        merchantData,
        bearerToken,
        apiPublicKey
      );

      // Step 2: Update merchant data with wallet address
      const updatedMerchantData = {
        ...merchantData,
        wallet_address: walletResult.wallet.publicKey,
        authMethod: 'wallet' as const
      };

      // Step 3: Register in database
      const dbResult = await this.registerInDatabase(updatedMerchantData);
      
      if (!dbResult.success) {
        return {
          ...dbResult,
          wallet: walletResult.wallet,
          walletTxHash: walletResult.txHash
        };
      }

      // Step 4: Register on contract
      let contractTxHash: string | undefined;
      try {
        contractTxHash = await this.registerMerchantOnContract(
          merchantData,
          walletResult.wallet.publicKey,
          walletResult.wallet.encryptedPrivateKey,
          bearerToken,
          contractAddress
        );

        // Step 5: Update merchant status in database
        if (dbResult.merchant?.id) {
          await this.updateMerchantContractStatus(dbResult.merchant.id, {
            contractRegistered: true,
            contractTxHash,
            walletAddress: walletResult.wallet.publicKey
          });
        }
      } catch (contractError) {
        console.warn('Contract registration failed, but database registration succeeded:', contractError);
        // Don't fail the entire process if contract registration fails
        // The merchant can retry contract registration later
      }

      return {
        success: true,
        merchant: dbResult.merchant,
        apiKeys: dbResult.apiKeys,
        wallet: walletResult.wallet,
        walletTxHash: walletResult.txHash,
        contractRegistrationTxHash: contractTxHash,
        requiresContractRegistration: !contractTxHash
      };

    } catch (error) {
      console.error('Complete merchant registration failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed'
      };
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


  static async getProfile(): Promise<any[]> {
      const response = await AuthManager.makeAuthenticatedRequest("/api/merchants/profile");
  
      if (!response.ok) {
        throw new Error(`Failed to fetch Profile: ${response.statusText}`);
      }
  
      return response.json();
    }
}

export default MerchantRegistrationService;