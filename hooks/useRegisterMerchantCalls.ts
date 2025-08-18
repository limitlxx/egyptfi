// hooks/useRegisterMerchantCalls.ts
import { useMemo } from 'react';
import { useContract } from "@starknet-react/core";
import { EGYPTFI_ABI } from "@/lib/abi";
import { EGYPT_SEPOLIA_CONTRACT_ADDRESS } from "@/lib/utils";
import { truncateToFelt252, emailToFelt252 } from "@/lib/felt252-utils";
import { MerchantRegistrationData } from "@/services/merchantRegistrationService";

interface UseRegisterMerchantCallsOptions {
  merchantData?: MerchantRegistrationData | {
    business_name?: string;
    business_email?: string;
    id?: string;
    [key: string]: any;
  } | null;
  walletAddress?: string;
  enabled?: boolean;
}

interface PreparedContractData {
  nameAsFelt: string;
  emailAsFelt: string;
  withdrawalAddress: string;
  feePercentage: number;
}

export const useRegisterMerchantCalls = ({
  merchantData,
  walletAddress,
  enabled = true,
}: UseRegisterMerchantCallsOptions) => {

  // console.log("useRegisterMerchantCalls....")
  const { contract } = useContract({
    abi: EGYPTFI_ABI,
    address: EGYPT_SEPOLIA_CONTRACT_ADDRESS,
  });

  const contractData = useMemo<PreparedContractData | null>(() => {
    if (!merchantData || !walletAddress || !enabled) {
      return null;
    }
    
    try {
      // Handle both MerchantRegistrationData and legacy merchant object formats
      let businessName: any;
      let businessEmail: any;

      if ('business_name' in merchantData && 'business_email' in merchantData) {
        // MerchantRegistrationData format
        businessName = merchantData.business_name;
        businessEmail = merchantData.business_email;
      } else {
        // Legacy format - fallback to name/email properties
        businessName = (merchantData as any).business_name || (merchantData as any).name;
        businessEmail = (merchantData as any).business_email || (merchantData as any).email;
      }

      if (!businessName || !businessEmail) {
        console.error('Missing business name or email:', { businessName, businessEmail });
        return null;
      }

      // Convert string data to felt252 format
      const nameAsFelt = truncateToFelt252(businessName);
      const emailAsFelt = emailToFelt252(businessEmail);
      const withdrawalAddress = walletAddress;
      const feePercentage = 50; // 0.5% as basis points (50/10000 = 0.5%)

      return {
        nameAsFelt,
        emailAsFelt,
        withdrawalAddress,
        feePercentage
      };
    } catch (error) {
      console.error("Error preparing contract data:", error);
      return null;
    }
  }, [merchantData, walletAddress, enabled]);

  const calls = useMemo(() => { 
    if (!contract || !contractData) {
      return undefined;
    }
    
    try {
      console.log("Preparing contract call with data:", contractData);

      return [contract.populate("register_merchant", [
        contractData.nameAsFelt,
        contractData.emailAsFelt,
        contractData.withdrawalAddress,
        contractData.feePercentage
      ])];
    } catch (error) {
      console.error("Error preparing contract calls:", error);
      return undefined;
    }
  }, [contract, contractData]);

  return {
    calls,
    contractData,
    isReady: !!(calls && merchantData && walletAddress && contractData),
  };
};