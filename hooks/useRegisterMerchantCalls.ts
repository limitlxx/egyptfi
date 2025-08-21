import { useMemo } from 'react';
import { useContract } from '@starknet-react/core';
import { Call } from 'starknet';
import { EGYPTFI_ABI } from '@/lib/abi';
import { EGYPT_SEPOLIA_CONTRACT_ADDRESS } from '@/lib/utils';
import { truncateToFelt252, emailToFelt252 } from '@/lib/felt252-utils';
import { MerchantRegistrationData } from '@/services/merchantRegistrationService';

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
  const { contract } = useContract({
    abi: EGYPTFI_ABI,
    address: EGYPT_SEPOLIA_CONTRACT_ADDRESS,
  });

  const contractData = useMemo<PreparedContractData | null>(() => {
    console.log('useRegisterMerchantCalls inputs:', { merchantData, walletAddress, enabled });

    if (!merchantData || !walletAddress || !enabled) {
      console.warn('useRegisterMerchantCalls: Invalid inputs, returning null contractData', {
        hasMerchantData: !!merchantData,
        hasWalletAddress: !!walletAddress,
        enabled,
      });
      return null;
    }

    try {
      let businessName: string | undefined;
      let businessEmail: string | undefined;

      if ('business_name' in merchantData && 'business_email' in merchantData) {
        businessName = merchantData.business_name;
        businessEmail = merchantData.business_email;
      } else {
        businessName = (merchantData as any).business_name || (merchantData as any).name;
        businessEmail = (merchantData as any).business_email || (merchantData as any).email;
      }

      if (!businessName || !businessEmail) {
        console.error('Missing business name or email:', { businessName, businessEmail });
        return null;
      }

      const nameAsFelt = truncateToFelt252(businessName);
      const emailAsFelt = emailToFelt252(businessEmail);
      const withdrawalAddress = walletAddress;
      const feePercentage = 50; // 0.5% as basis points (50/10000 = 0.5%)

      return {
        nameAsFelt,
        emailAsFelt,
        withdrawalAddress,
        feePercentage,
      };
    } catch (error) {
      console.error('Error preparing contract data:', error);
      return null;
    }
  }, [merchantData, walletAddress, enabled]);

  const calls = useMemo<Call[] | undefined>(() => {
    if (!contract || !contractData) {
      console.warn('useRegisterMerchantCalls: No contract or contractData, returning undefined calls', {
        hasContract: !!contract,
        hasContractData: !!contractData,
      });
      return undefined;
    }

    try {
      console.log('Preparing contract call with data:', contractData);

      return [
        contract.populate('register_merchant', [
          contractData.nameAsFelt,
          contractData.emailAsFelt,
          contractData.withdrawalAddress,
          contractData.feePercentage,
        ]),
      ];
    } catch (error) {
      console.error('Error preparing contract calls:', error);
      return undefined;
    }
  }, [contract, contractData]);

  const isReady = useMemo(() => {
    const ready = enabled && !!calls && calls.length > 0 && !!merchantData && !!walletAddress && !!contractData && !!contract;
    console.log('useRegisterMerchantCalls isReady:', ready, {
      enabled,
      callsLength: calls?.length,
      hasMerchantData: !!merchantData,
      hasWalletAddress: !!walletAddress,
      hasContractData: !!contractData,
      hasContract: !!contract,
    });
    return ready;
  }, [enabled, calls, merchantData, walletAddress, contractData, contract]);

  return {
    calls,
    contractData,
    isReady,
  };
};