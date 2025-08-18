// hooks/useMerchantRegistration.ts
import { useState, useCallback } from "react";
import { useProvider } from "@starknet-react/core";
import MerchantRegistrationService, {
  MerchantRegistrationData,
  RegistrationResult,
  ContractRegistrationData,
} from "@/services/merchantRegistrationService";
import { useRegisterMerchantCalls } from "./useRegisterMerchantCalls";
import { usePaymaster } from "./usePayMaster";
import toast from "react-hot-toast";

interface MerchantRegistrationState {
  isRegistering: boolean;
  isContractRegistering: boolean;
  isVerifying: boolean;
  registrationStep:
    | "idle"
    | "database"
    | "contract"
    | "verification"
    | "complete";
  dbResult: RegistrationResult | null;
  contractData: ContractRegistrationData | null;
  pendingMerchantData: MerchantRegistrationData | null; // Store original data for contract-first flow
  error: string | null;
}

interface UseMerchantRegistrationResult extends MerchantRegistrationState {
  registerMerchant: (
    data: MerchantRegistrationData,
    walletAddress?: string,
    isDeployed?: boolean
  ) => Promise<boolean>;
  resetRegistration: () => void;
}

export const useMerchantRegistration = (): UseMerchantRegistrationResult => {
  const [state, setState] = useState<MerchantRegistrationState>({
    isRegistering: false,
    isContractRegistering: false,
    isVerifying: false,
    registrationStep: "idle",
    dbResult: null,
    contractData: null,
    pendingMerchantData: null,
    error: null,
  });

  const { provider } = useProvider();

  // Prepare contract registration calls
  // console.log("Add Merchant Contract Call");

  const { calls, isReady } = useRegisterMerchantCalls({
    merchantData: state.pendingMerchantData,
    walletAddress: state.contractData?.withdrawalAddress,
    enabled: !!(state.contractData && state.pendingMerchantData),
  });

  // Handle paymaster transaction
  const {
    executeTransaction,
    isLoading: isTransactionLoading,
    isSuccess: isTransactionSuccess,
    transactionHash,
    txError,
  } = usePaymaster({
    calls,
    enabled: isReady,
    onSuccess: (hash: string) => {
      console.log("Contract registration transaction successful:", hash);
      handleContractRegistrationSuccess(hash);
    },
    onError: (error: any) => {
      console.error("Contract registration transaction failed:", error);
      handleContractRegistrationError(error);
    },
  });

  const handleContractRegistrationSuccess = useCallback(
    async (hash: string) => {
      setState((prev) => ({
        ...prev,
        isContractRegistering: false,
        isVerifying: true,
        registrationStep: "verification",
      }));

      toast.success("Contract registration successful! Creating account...", {
        id: "registration",
      });

      try {
        // Step 1: Verify the contract registration was successful
        const isVerified =
          await MerchantRegistrationService.verifyContractRegistration(
            state.contractData!.withdrawalAddress,
            provider
          );

        if (!isVerified) {
          throw new Error(
            "Contract registration could not be verified on blockchain"
          );
        }

        // Step 2: Now register in database with contract transaction hash
        setState((prev) => ({
          ...prev,
          registrationStep: "database",
        }));

        toast.loading("Creating account in database...", {
          id: "registration",
        });

        // Add transaction hash to merchant data
        const merchantDataWithTx = {
          ...state.pendingMerchantData!,
          transaction_hash: hash,
        };

        const dbResult = await MerchantRegistrationService.registerInDatabase(
          merchantDataWithTx
        );

        if (!dbResult.success) {
          // Contract succeeded but database failed - this is a critical error
          // We should log this for manual intervention
          console.error(
            "CRITICAL: Contract registration succeeded but database registration failed",
            {
              transactionHash: hash,
              contractData: state.contractData,
              merchantData: state.pendingMerchantData,
              dbError: dbResult.error,
            }
          );

          throw new Error(
            `Database registration failed after successful contract registration. Transaction: ${hash}. Please contact support.`
          );
        }

        // Step 3: Store merchant data and API keys
        MerchantRegistrationService.storeMerchantData(dbResult.merchant!);
        if (dbResult.apiKeys) {
          MerchantRegistrationService.storeApiKeys(dbResult.apiKeys);
        }

        // Step 4: Update merchant with contract status
        await MerchantRegistrationService.updateMerchantContractStatus(
          dbResult.merchant!.id,
          {
            transactionHash: hash,
            contractData: state.contractData,
          }
        );

        setState((prev) => ({
          ...prev,
          isVerifying: false,
          registrationStep: "complete",
          dbResult,
        }));

        toast.success("Registration complete! Redirecting to dashboard...", {
          id: "registration",
        });
        return true;
      } catch (error) {
        console.error("Registration error after contract success:", error);

        setState((prev) => ({
          ...prev,
          isVerifying: false,
          error:
            error instanceof Error
              ? error.message
              : "Registration failed after contract success",
          registrationStep: "idle",
        }));

        toast.error(
          error instanceof Error
            ? error.message
            : "Registration failed after contract success",
          { id: "registration" }
        );
        return false;
      }
    },
    [state.contractData, state.pendingMerchantData, provider]
  );

  const handleContractRegistrationError = useCallback((error: any) => {
    setState((prev) => ({
      ...prev,
      isContractRegistering: false,
      error:
        error instanceof Error ? error.message : "Contract registration failed",
      registrationStep: "idle",
    }));
    toast.error("Contract registration failed");
  }, []);

  const registerMerchant = useCallback(
    async (
      data: MerchantRegistrationData,
      walletAddress?: string,
      isDeployed?: boolean
    ): Promise<boolean> => {
      setState((prev) => ({
        ...prev,
        isRegistering: true,
        error: null,
      }));

      try {
        // Check if contract registration is required
        const requiresContractRegistration =
          data.authMethod === "wallet" && walletAddress && isDeployed;

        if (requiresContractRegistration) {
          // CONTRACT-FIRST FLOW: Contract → Verification → Database

          // Step 1: Store pending merchant data and prepare contract data
          const contractData = MerchantRegistrationService.prepareContractData(
            data,
            walletAddress
          );

          setState((prev) => ({
            ...prev,
            registrationStep: "contract",
            isContractRegistering: true,
            contractData,
            pendingMerchantData: data, // Store for later database registration
          }));

          toast.loading("Registering on blockchain...", { id: "registration" });

          // Step 2: Execute contract registration first
          await executeTransaction();

          // The contract success will trigger handleContractRegistrationSuccess
          // which will then handle database registration
          return true;
        } else {
          // DATABASE-ONLY FLOW: For non-wallet or non-deployed accounts
          setState((prev) => ({
            ...prev,
            registrationStep: "database",
          }));

          toast.loading("Creating account...", { id: "registration" });

          const dbResult = await MerchantRegistrationService.registerInDatabase(
            data
          );

          if (!dbResult.success) {
            throw new Error(dbResult.error || "Database registration failed");
          }

          // Store merchant data and API keys
          MerchantRegistrationService.storeMerchantData(dbResult.merchant!);
          if (dbResult.apiKeys) {
            MerchantRegistrationService.storeApiKeys(dbResult.apiKeys);
          }

          setState((prev) => ({
            ...prev,
            isRegistering: false,
            registrationStep: "complete",
            dbResult,
          }));

          if (data.authMethod === "wallet" && walletAddress && !isDeployed) {
            toast.success(
              "Account created! (Blockchain registration skipped - wallet not deployed)",
              { id: "registration" }
            );
          } else {
            toast.success("Account created successfully!", {
              id: "registration",
            });
          }

          return true;
        }
      } catch (error) {
        console.error("Registration error:", error);

        setState((prev) => ({
          ...prev,
          isRegistering: false,
          isContractRegistering: false,
          error: error instanceof Error ? error.message : "Registration failed",
          registrationStep: "idle",
        }));

        toast.error(
          error instanceof Error ? error.message : "Registration failed",
          { id: "registration" }
        );
        return false;
      }
    },
    [executeTransaction]
  );

  const resetRegistration = useCallback(() => {
    setState({
      isRegistering: false,
      isContractRegistering: false,
      isVerifying: false,
      registrationStep: "idle",
      dbResult: null,
      contractData: null,
      pendingMerchantData: null,
      error: null,
    });
  }, []);

  return {
    ...state,
    isContractRegistering: state.isContractRegistering || isTransactionLoading,
    registerMerchant,
    resetRegistration,
  };
};
