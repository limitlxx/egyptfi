import {
  ChipiPayService,
  CreateWalletParams,
  CreateWalletResponse,
  TransferParams,
  ApproveParams,
  StakeParams,
  WithdrawParams,
  ContractCallParams,
  TransactionResponse,
  ChipiPayError,
  ChipiPayErrorCodes,
} from "./types/chipipay.types";

// External dependencies for wallet creation
import CryptoJS from "crypto-js";
import type { DeploymentData } from "@avnu/gasless-sdk";
import {
  Account,
  CairoCustomEnum,
  CairoOption,
  CairoOptionVariant,
  CallData,
  ec,
  hash,
  num,
  RpcProvider,
  stark,
} from "starknet";

// Encryption utility
const encryptPrivateKey = (privateKey: string, password: string): string => {
  if (!privateKey || !password) {
    throw new Error("Private key and password are required");
  }
  return CryptoJS.AES.encrypt(privateKey, password).toString();
};

// Types for wallet data
interface WalletData {
  publicKey: string;
  encryptedPrivateKey: string;
}

export class ChipiPayServiceImpl implements ChipiPayService {
  private readonly baseUrl: string;
  private readonly timeout: number = 30000; // 30 seconds
  private readonly rpcUrl: string;

  constructor(
    baseUrl: string = process.env.CHIPIPAY_URL || "https://api.chipipay.com/v1",
    rpcUrl: string = process.env.STARKNET_RPC_URL ||
      "https://starknet-mainnet.infura.io/v3/YOUR_PROJECT_ID"
  ) {
    this.baseUrl = baseUrl;
    this.rpcUrl = rpcUrl;
  }

  /**
   * Create an invisible wallet using ChipiPay's actual implementation
   */
  async createWallet(
    params: CreateWalletParams
  ): Promise<CreateWalletResponse> {
    try {
      this.logOperation("createWallet", {
        externalUserId: params.externalUserId,
      });

      const { encryptKey, apiPublicKey, bearerToken } = params;

      // Temporary fallback for development if ChipiPay API is not accessible
      if (
        process.env.NODE_ENV === "development" &&
        process.env.CHIPIPAY_MOCK_MODE === "true"
      ) {
        console.log("[ChipiPay] Using mock mode for development");
        return this.createMockWallet(params);
      }

      const provider = new RpcProvider({ nodeUrl: this.rpcUrl });

      // Generating the private key with Stark Curve
      const privateKeyAX = stark.randomAddress();
      const starkKeyPubAX = ec.starkCurve.getStarkKey(privateKeyAX);

      // Using Argent X Account v0.4.0 class hash
      const accountClassHash =
        "0x036078334509b514626504edc9fb252328d1a240e4e948bef8d0c08dff45927f";

      // Calculate future address of the ArgentX account
      const axSigner = new CairoCustomEnum({
        Starknet: { pubkey: starkKeyPubAX },
      });

      // Set the dApp Guardian address
      const axGuardian = new CairoOption<unknown>(CairoOptionVariant.None);

      const AXConstructorCallData = CallData.compile({
        owner: axSigner,
        guardian: axGuardian,
      });

      const publicKey = hash.calculateContractAddressFromHash(
        starkKeyPubAX,
        accountClassHash,
        AXConstructorCallData,
        0
      );

      // Initiating Account
      const account = new Account({
        provider: provider,
        address: publicKey,
        signer: privateKeyAX,
      });

      // Backend Call API to create the wallet
      console.log("ChipiPay API Request Details:", {
        url: `${this.baseUrl}/chipi-wallets/prepare-creation`,
        apiPublicKey,
        bearerTokenLength: bearerToken?.length,
        publicKey: publicKey.substring(0, 10) + "...",
      });

      const typeDataResponse = await fetch(
        `${this.baseUrl}/chipi-wallets/prepare-creation`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${bearerToken}`,
            "x-api-key": apiPublicKey,
          },
          body: JSON.stringify({
            publicKey,
          }),
        }
      );

      if (!typeDataResponse.ok) {
        const errorData = await typeDataResponse.json().catch(() => ({}));
        console.error("ChipiPay API Error Response:", {
          status: typeDataResponse.status,
          statusText: typeDataResponse.statusText,
          errorData,
          headers: Object.fromEntries(typeDataResponse.headers.entries()),
        });
        throw new Error(
          errorData.message ||
            `HTTP ${typeDataResponse.status}: ${typeDataResponse.statusText}`
        );
      }

      const { typeData, accountClassHash: accountClassHashResponse } =
        await typeDataResponse.json();

      // Sign the message
      const userSignature = await account.signMessage(typeData);

      const deploymentData: DeploymentData = {
        class_hash: accountClassHashResponse,
        salt: starkKeyPubAX,
        unique: `${num.toHex(0)}`,
        calldata: AXConstructorCallData.map((value: any) => num.toHex(value)),
      };

      const encryptedPrivateKey = encryptPrivateKey(privateKeyAX, encryptKey);

      // Call API to save the wallet in dashboard
      const executeTransactionResponse = await fetch(
        `${this.baseUrl}/chipi-wallets`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${bearerToken}`,
            "x-api-key": apiPublicKey,
          },
          body: JSON.stringify({
            apiPublicKey,
            publicKey,
            userSignature: {
              r: (userSignature as any).r.toString(),
              s: (userSignature as any).s.toString(),
              recovery: (userSignature as any).recovery,
            },
            typeData,
            encryptedPrivateKey,
            deploymentData: {
              ...deploymentData,
              salt: `${deploymentData.salt}`,
              calldata: deploymentData.calldata.map((data: any) => `${data}`),
            },
          }),
        }
      );

      if (!executeTransactionResponse.ok) {
        const errorData = await executeTransactionResponse
          .json()
          .catch(() => ({}));
        throw new Error(
          errorData.message ||
            `HTTP ${executeTransactionResponse.status}: ${executeTransactionResponse.statusText}`
        );
      }

      const executeTransaction = await executeTransactionResponse.json();
      console.log("Execute transaction: ", executeTransaction);

      if (executeTransaction.success) {
        const result = {
          success: true,
          txHash: executeTransaction.txHash,
          wallet: {
            publicKey: executeTransaction.walletPublicKey,
            encryptedPrivateKey: encryptedPrivateKey,
          } as WalletData,
        };

        this.logOperation("createWallet", {
          externalUserId: params.externalUserId,
          success: true,
          txHash: executeTransaction.txHash,
          publicKey: executeTransaction.walletPublicKey,
        });

        return result;
      } else {
        throw new Error(
          "Wallet creation failed: " +
            (executeTransaction.error || "Unknown error")
        );
      }
    } catch (error: unknown) {
      console.error("Error creating wallet:", error);

      if (error instanceof Error && error.message.includes("SSL")) {
        throw new Error(
          "SSL connection error. Try using NODE_TLS_REJECT_UNAUTHORIZED=0 or verify the RPC URL"
        );
      }

      this.logError("createWallet", error, params.externalUserId);
      throw this.createChipiPayError(
        ChipiPayErrorCodes.WALLET_CREATION_FAILED,
        error
      );
    }
  }

  /**
   * Make HTTP request to ChipiPay API with timeout and error handling
   */
  private async makeRequest(
    endpoint: string,
    options: RequestInit
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error?.name === "AbortError") {
        throw new Error("Request timeout");
      }

      throw error;
    }
  }

  /**
   * Create standardized ChipiPay error
   */
  private createChipiPayError(
    code: ChipiPayErrorCodes,
    originalError: any
  ): ChipiPayError {
    return new ChipiPayError(
      code,
      originalError.message || "Unknown error occurred",
      originalError
    );
  }

  /**
   * Log operation for audit trail
   */
  private logOperation(operation: string, data: any): void {
    console.log(`[ChipiPay] ${operation}:`, {
      timestamp: new Date().toISOString(),
      operation,
      ...data,
    });
  }

  /**
   * Log error for debugging and monitoring
   */
  private logError(operation: string, error: any, context?: string): void {
    console.error(`[ChipiPay] ${operation} failed:`, {
      timestamp: new Date().toISOString(),
      operation,
      error: error.message,
      context,
      stack: error.stack,
    });
  }

  /**
   * Create a mock wallet for development/testing purposes
   * This should only be used when ChipiPay API is not accessible
   */
  private async createMockWallet(
    params: CreateWalletParams
  ): Promise<CreateWalletResponse> {
    const { encryptKey, externalUserId } = params;

    // Generate mock wallet data
    const privateKey = stark.randomAddress();
    const publicKey = ec.starkCurve.getStarkKey(privateKey);
    const encryptedPrivateKey = encryptPrivateKey(privateKey, encryptKey);

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const mockResult = {
      success: true,
      txHash: `0x${Math.random().toString(16).substr(2, 64)}`,
      wallet: {
        publicKey: `0x${publicKey}`,
        encryptedPrivateKey: encryptedPrivateKey,
      } as WalletData,
    };

    this.logOperation("createMockWallet", {
      externalUserId,
      success: true,
      txHash: mockResult.txHash,
      publicKey: mockResult.wallet.publicKey.substring(0, 10) + "...",
      note: "MOCK WALLET - NOT REAL BLOCKCHAIN TRANSACTION",
    });

    return mockResult;
  }
}

// Export singleton instance
export const chipipayService = new ChipiPayServiceImpl();
