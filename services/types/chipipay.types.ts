// ChipiPay Service Types and Interfaces

export interface CreateWalletParams {
  encryptKey: string;
  externalUserId: string;
  apiPublicKey: string;
  bearerToken: any;
}

export interface CreateWalletResponse {
  success: boolean;
  txHash: string;
  wallet: {
    publicKey: string;
    encryptedPrivateKey: string;
  };
  error?: string;
}

export interface TransferParams {
  privateKey: string;
  recipient: string;
  amount: string;
  contractAddress?: string;
  decimals?: number;
  bearerToken: string;
}

export interface ApproveParams {
  privateKey: string;
  contractAddress: string;
  spender: string;
  amount: string;
  decimals?: number;
  bearerToken: string;
}

export interface StakeParams {
  privateKey: string;
  amount: string;
  receiverWallet: string;
  bearerToken: string;
}

export interface WithdrawParams {
  privateKey: string;
  amount: string;
  recipient: string;
  bearerToken: string;
}

export interface ContractCallParams {
  privateKey: string; // This is the encrypted private key
  contractAddress: string;
  entrypoint: string;
  calldata: any[];
  bearerToken: string;
  encryptKey?: string; // PIN to decrypt the private key
  walletPublicKey?: string; // Public key of the wallet
}

export interface TransactionResponse {
  success: boolean;
  txHash: string;
  data?: any;
  error?: string;
}

export interface ChipiPayError {
  code: ChipiPayErrorCodes;
  message: string;
  details?: any;
}

export interface ChipiPayService {
  createWallet(params: CreateWalletParams): Promise<CreateWalletResponse>;
  // transfer(params: TransferParams): Promise<TransactionResponse>;
  // approve(params: ApproveParams): Promise<TransactionResponse>;
  // stakeVesuUsdc(params: StakeParams): Promise<TransactionResponse>;
  // withdrawVesuUsdc(params: WithdrawParams): Promise<TransactionResponse>;
  // callAnyContract(params: ContractCallParams): Promise<TransactionResponse>;
}

export enum ChipiPayErrorCodes {
  WALLET_CREATION_FAILED = 'WALLET_CREATION_FAILED',
  TRANSFER_FAILED = 'TRANSFER_FAILED',
  APPROVE_FAILED = 'APPROVE_FAILED',
  STAKE_FAILED = 'STAKE_FAILED',
  WITHDRAW_FAILED = 'WITHDRAW_FAILED',
  CONTRACT_CALL_FAILED = 'CONTRACT_CALL_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE'
}

export class ChipiPayError extends Error {
  constructor(
    public code: ChipiPayErrorCodes,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ChipiPayError';
  }
}