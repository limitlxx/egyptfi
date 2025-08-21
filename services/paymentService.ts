import { Call, Contract } from "starknet"; 
import { EGYPTFI_ABI } from "@/lib/abi";
import { EGYPT_SEPOLIA_CONTRACT_ADDRESS } from "@/lib/utils";

// Interface for payment data (based on route.ts and InvoiceContent.tsx)
interface PaymentData {
  payment_ref: string;
  amount: number;
  currency: string;
  merchant_name: string;
  merchant_logo?: string;
  description?: string;
  secondary_endpoint?: string;
  status: string;
  created_at: string;
  paid_at?: string;
  tx_hash?: string;
  payment_endpoint: string;
  qrCode: string;
}

// Interface for swap data (based on EGYPTFI_ABI)
interface SwapData {
  params: {
    amount: { mag: number; sign: boolean };
    is_token1: boolean;
    sqrt_ratio_limit: { low: number; high: number };
    skip_ahead: number;
  };
  pool_key: {
    token0: string;
    token1: string;
    fee: number;
    tick_spacing: number;
    extension: string;
  };
  caller: string;
}

// Create a new payment (calls /api/payments/initiate POST)
export async function create_payment({
  payment_ref,
  local_amount,
  local_currency,
  description,
  chain = "starknet",
  secondary_endpoint,
  email,
  apiKey,
  walletAddress,
  environment,
}: {
  payment_ref: string;
  local_amount: number;
  local_currency: string;
  description?: string;
  chain?: string;
  secondary_endpoint?: string;
  email: string;
  apiKey: string;
  walletAddress: string;
  environment: string;
}): Promise<PaymentData> {
  const response = await fetch("/api/payments/initiate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      "X-Wallet-Address": walletAddress,
      "X-Environment": environment,
    },
    body: JSON.stringify({
      payment_ref,
      local_amount,
      local_currency,
      description,
      chain,
      secondary_endpoint,
      email,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create payment: ${response.statusText}`);
  }

  const result = await response.json();
  return {
    payment_ref: result.reference,
    payment_endpoint: result.authorization_url,
    qrCode: result.qr_code,
    amount: local_amount,
    currency: local_currency,
    description,
    secondary_endpoint,
    status: "pending",
    created_at: new Date().toISOString(),
    merchant_name: "Unknown", // Fetch from API response if available
  };
}

// Fetch payment details
export async function get_payment(payment_ref: string): Promise<PaymentData> {
  const response = await fetch(`/api/payments/initiate?payment_ref=${payment_ref}`);
  if (!response.ok) {
    throw new Error("Failed to fetch payment");
  }
  const result = await response.json();
  return result.data;
}

// Prepare payment call (to be used with usePaymaster in component)
export function prepare_payment_call({
  payment_ref,
  amount,
  token_address,
  contract_address,
  caller,
}: {
  payment_ref: string;
  amount: number;
  token_address: string;
  contract_address: string;
  caller: string;
}): Call {
  const swapData: SwapData = {
    params: {
      amount: { mag: amount, sign: false },
      is_token1: true,
      sqrt_ratio_limit: { low: 0, high: 0 }, // Replace with oracle data
      skip_ahead: 0,
    },
    pool_key: {
      token0: "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8", // USDC Sepolia
      token1: token_address,
      fee: 3000,
      tick_spacing: 60,
      extension: "0x0", // Replace with actual extension
    },
    caller,
  };

  return {
    contractAddress: contract_address || EGYPT_SEPOLIA_CONTRACT_ADDRESS,
    entrypoint: "process_payment",
    calldata: [payment_ref, swapData],
  };
}

// Verify payment status (polls contract or API)
export async function verify_payment({
  payment_ref,
  contract_address,
  provider,
}: {
  payment_ref: string;
  contract_address: string;
  provider: any;
}): Promise<boolean> {
  // Check via API first
  const payment = await get_payment(payment_ref);
  if (payment.status === "paid") {
    return true;
  }

  // Fallback to contract
  const contract = new Contract(EGYPTFI_ABI, contract_address, provider);
  const paymentInfo = await contract.call("get_payment", [payment_ref]);
  return paymentInfo.status === "Completed"; // Adjust based on ABI
}

// Update payment status
export async function update_payment_status({
  payment_ref,
  status,
  tx_hash,
}: {
  payment_ref: string;
  status: string;
  tx_hash?: string;
}) {
  await fetch("/api/payments/status", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      payment_ref,
      status,
      paid_at: status === "paid" ? new Date().toISOString() : undefined,
      tx_hash,
    }),
  });
}