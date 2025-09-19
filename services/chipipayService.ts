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

export class ChipiPayServiceImpl implements ChipiPayService {
  private readonly baseUrl: string;
  private readonly timeout: number = 30000; // 30 seconds

  constructor(
    baseUrl: string = process.env.CHIPIPAY_URL || "https://api.chipipay.com/v1"
  ) {
    this.baseUrl = baseUrl;
  }

  /**
   * Create an invisible wallet using ChipiPay's createWallet function
   */
  async createWallet(
    params: CreateWalletParams
  ): Promise<CreateWalletResponse> {
    try {
      this.logOperation("createWallet", {
        externalUserId: params.externalUserId,
      });

      const response = await this.makeRequest("/wallet/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${params.bearerToken}`,
          "X-API-Key": params.apiPublicKey,
        },
        body: JSON.stringify({
          encryptKey: params.encryptKey,
          externalUserId: params.externalUserId,
        }),
      });

      if (!response.success) {
        throw new Error(response.error || "Wallet creation failed");
      }

      this.logOperation("createWallet", {
        externalUserId: params.externalUserId,
        success: true,
        txHash: response.txHash,
      });

      return {
        success: true,
        txHash: response.txHash,
        wallet: {
          publicKey: response.wallet.publicKey,
          encryptedPrivateKey: response.wallet.encryptedPrivateKey,
        },
      };
    } catch (error) {
      this.logError("createWallet", error, params.externalUserId);
      throw this.createChipiPayError(
        ChipiPayErrorCodes.WALLET_CREATION_FAILED,
        error
      );
    }
  }

  /**
   * Transfer tokens using ChipiPay's useTransfer hook
   */
  async transfer(params: TransferParams): Promise<TransactionResponse> {
    try {
      this.logOperation("transfer", {
        recipient: params.recipient,
        amount: params.amount,
        contractAddress: params.contractAddress,
      });

      const response = await this.makeRequest("/wallet/transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${params.bearerToken}`,
        },
        body: JSON.stringify({
          privateKey: params.privateKey,
          recipient: params.recipient,
          amount: params.amount,
          contractAddress: params.contractAddress,
          decimals: params.decimals,
        }),
      });

      if (!response.success) {
        throw new Error(response.error || "Transfer failed");
      }

      this.logOperation("transfer", {
        recipient: params.recipient,
        amount: params.amount,
        success: true,
        txHash: response.txHash,
      });

      return {
        success: true,
        txHash: response.txHash,
        data: response.data,
      };
    } catch (error) {
      this.logError("transfer", error, params.recipient);
      throw this.createChipiPayError(ChipiPayErrorCodes.TRANSFER_FAILED, error);
    }
  }

  /**
   * Approve token spending using ChipiPay's useApprove hook
   */
  async approve(params: ApproveParams): Promise<TransactionResponse> {
    try {
      this.logOperation("approve", {
        contractAddress: params.contractAddress,
        spender: params.spender,
        amount: params.amount,
      });

      const response = await this.makeRequest("/wallet/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${params.bearerToken}`,
        },
        body: JSON.stringify({
          privateKey: params.privateKey,
          contractAddress: params.contractAddress,
          spender: params.spender,
          amount: params.amount,
          decimals: params.decimals,
        }),
      });

      if (!response.success) {
        throw new Error(response.error || "Approval failed");
      }

      this.logOperation("approve", {
        contractAddress: params.contractAddress,
        spender: params.spender,
        success: true,
        txHash: response.txHash,
      });

      return {
        success: true,
        txHash: response.txHash,
        data: response.data,
      };
    } catch (error) {
      this.logError("approve", error, params.spender);
      throw this.createChipiPayError(ChipiPayErrorCodes.APPROVE_FAILED, error);
    }
  }

  /**
   * Stake USDC in VESU using ChipiPay's useStakeVesuUsdc hook
   */
  async stakeVesuUsdc(params: StakeParams): Promise<TransactionResponse> {
    try {
      this.logOperation("stakeVesuUsdc", {
        amount: params.amount,
        receiverWallet: params.receiverWallet,
      });

      const response = await this.makeRequest("/wallet/stake-vesu-usdc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${params.bearerToken}`,
        },
        body: JSON.stringify({
          privateKey: params.privateKey,
          amount: params.amount,
          receiverWallet: params.receiverWallet,
        }),
      });

      if (!response.success) {
        throw new Error(response.error || "VESU staking failed");
      }

      this.logOperation("stakeVesuUsdc", {
        amount: params.amount,
        receiverWallet: params.receiverWallet,
        success: true,
        txHash: response.txHash,
      });

      return {
        success: true,
        txHash: response.txHash,
        data: response.data,
      };
    } catch (error) {
      this.logError("stakeVesuUsdc", error, params.receiverWallet);
      throw this.createChipiPayError(ChipiPayErrorCodes.STAKE_FAILED, error);
    }
  }

  /**
   * Withdraw from VESU using ChipiPay's useWithdrawVesuUsdc hook
   */
  async withdrawVesuUsdc(params: WithdrawParams): Promise<TransactionResponse> {
    try {
      this.logOperation("withdrawVesuUsdc", {
        amount: params.amount,
        recipient: params.recipient,
      });

      const response = await this.makeRequest("/wallet/withdraw-vesu-usdc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${params.bearerToken}`,
        },
        body: JSON.stringify({
          privateKey: params.privateKey,
          amount: params.amount,
          recipient: params.recipient,
        }),
      });

      if (!response.success) {
        throw new Error(response.error || "VESU withdrawal failed");
      }

      this.logOperation("withdrawVesuUsdc", {
        amount: params.amount,
        recipient: params.recipient,
        success: true,
        txHash: response.txHash,
      });

      return {
        success: true,
        txHash: response.txHash,
        data: response.data,
      };
    } catch (error) {
      this.logError("withdrawVesuUsdc", error, params.recipient);
      throw this.createChipiPayError(ChipiPayErrorCodes.WITHDRAW_FAILED, error);
    }
  }

  /**
   * Call any contract using ChipiPay's useCallAnyContract hook
   */
  async callAnyContract(
    params: ContractCallParams
  ): Promise<TransactionResponse> {
    try {
      this.logOperation("callAnyContract", {
        contractAddress: params.contractAddress,
        entrypoint: params.entrypoint,
      });

      const response = await this.makeRequest("/wallet/call-contract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${params.bearerToken}`,
        },
        body: JSON.stringify({
          privateKey: params.privateKey,
          contractAddress: params.contractAddress,
          entrypoint: params.entrypoint,
          calldata: params.calldata,
        }),
      });

      if (!response.success) {
        throw new Error(response.error || "Contract call failed");
      }

      this.logOperation("callAnyContract", {
        contractAddress: params.contractAddress,
        entrypoint: params.entrypoint,
        success: true,
        txHash: response.txHash,
      });

      return {
        success: true,
        txHash: response.txHash,
        data: response.data,
      };
    } catch (error) {
      this.logError("callAnyContract", error, params.contractAddress);
      throw this.createChipiPayError(
        ChipiPayErrorCodes.CONTRACT_CALL_FAILED,
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
}

// Export singleton instance
export const chipipayService = new ChipiPayServiceImpl();
