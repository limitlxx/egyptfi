import { Call, Contract } from "starknet";
import { EGYPTFI_ABI } from "@/lib/abi";
import { EGYPT_SEPOLIA_CONTRACT_ADDRESS } from "@/lib/utils"; 

// Interface for payment data (unchanged)
interface PaymentData {
  paymentId: any;
  paymentUrl: any;
  walletUrl: any;
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

  // new fields
  tokenPaid?: string;
  merchantReceived?: string;
  settlementChain?: string;
  chain?: string;
}

interface Payment {
  status: string;
  [key: string]: any; // if there are other dynamic fields
}

// Prepare payment call(s) - returns an array for multi-call
export async function prepare_payment_call({
  payment_ref,
  amount, // Input token amount (from convertedAmount)
  token_address,
  contract_address = EGYPT_SEPOLIA_CONTRACT_ADDRESS,
  userAddress, // Renamed from caller to clarify
  merchant_address, // Added merchant address for create_payment
  description = "", // Optional description, defaults to empty string
  usdc_address = "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8",
}: {
  payment_ref: string;
  amount: number;
  token_address: string;
  contract_address: string;
  userAddress: string; // User's connected wallet address
  merchant_address: string; // Merchant's contract address
  description?: string; // Optional description for the payment
  usdc_address?: string;
}): Promise<Call[]> {
  // Create payment call
  // const createPaymentCall: Call = {
  //   contractAddress: contract_address,
  //   entrypoint: "create_payment",
  //   calldata: [
  //     merchant_address, // merchant
  //     amount.toString(), // amount (u256 low)
  //     "0", // amount (u256 high)
  //     payment_ref, // reference
  //     description || "", // description (empty string if not provided)
  //   ],
  // };

  if (token_address === usdc_address) {
    // Direct USDC payment: approve + process_payment
    const approveCall: Call = {
      contractAddress: usdc_address,
      entrypoint: "approve",
      calldata: [contract_address, amount.toString(), "0"], // u256 low/high
    };
    const processCall: Call = {
      contractAddress: contract_address,
      entrypoint: "process_payment",
      calldata: [payment_ref],
    };
    return [approveCall, processCall];
  } else {
    // Swap to USDC via API
    const response = await fetch("/api/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tokenIn: token_address,
        tokenOut: usdc_address,
        amount,
        userAddress, // Pass user's wallet address
      }),
    });

    if (!response.ok) {
      throw new Error(`Swap failed: ${response.statusText}`);
    }

    const results = await response.json();

    // Prepare approve and process_payment calls
    const approveUsdcCall: Call = {
      contractAddress: usdc_address,
      entrypoint: "approve",
      calldata: [contract_address, results.usdcReceived.toString(), "0"], // Use received USDC amount
    };

    const processCall: Call = {
      contractAddress: contract_address,
      entrypoint: "process_payment",
      calldata: [payment_ref],
    };

    return [approveUsdcCall, processCall];
  }
}

// Fetch payment details (unchanged)
export async function initiate_payment({
  payment_ref,
  local_amount,
  local_currency,
  description,
  chain = "starknet",
  secondary_endpoint,
  email,
  api_key,
  wallet_address,
  environment = "testnet",
}: {
  payment_ref: string;
  local_amount: number;
  local_currency: string;
  description?: string;
  chain?: string;
  secondary_endpoint?: string;
  email: string;
  api_key: string;
  wallet_address: string;
  environment?: string;
}): Promise<{
  tx_hash: string;
  reference: string;
  authorization_url: string;
  qr_code: string;
  expires_at: string;
}> {
  const response = await fetch("/api/payments/initiate", {
    method: "POST",
    headers: {
      "x-api-key": api_key,
      "Content-Type": "application/json",
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
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to initiate payment");
  }

  return await response.json();
}

export async function get_payment(payment_ref: string): Promise<PaymentData> {
  const response = await fetch(`/api/payments/verify?payment_ref=${payment_ref}`, {
    method: "GET", 
    headers: { 
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error("Failed to fetch payment");
  }
  const result = await response.json();
  return result.data;
}

// Verify payment status (unchanged)
export async function verify_payment({
  payment_ref,
  contract_address,
  provider,
}: {
  payment_ref: string;
  contract_address: string;
  provider: any;
}): Promise<boolean> {
  const payment = await get_payment(payment_ref);
  if (payment.status === "paid") {
    return true;
  }
  const contract = new Contract({
        abi: EGYPTFI_ABI,
        address: contract_address,
        providerOrAccount: provider,
      });
  // const contract = new Contract(EGYPTFI_ABI, contract_address, provider);
  const paymentInfo = await contract.call("get_payment", [payment_ref]);
  // handle both tuple or object return
  const status =
    Array.isArray(paymentInfo) ? paymentInfo[0] : paymentInfo;

  return status === "Completed";
}

// Update payment status (unchanged)
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