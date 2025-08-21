import { Call, Contract } from "starknet";
import { EGYPTFI_ABI } from "@/lib/abi";
import { EGYPT_SEPOLIA_CONTRACT_ADDRESS } from "@/lib/utils"; 

// Interface for payment data (unchanged)
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
  usdc_address = "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8",
}: {
  payment_ref: string;
  amount: number;
  token_address: string;
  contract_address: string;
  userAddress: string; // User's connected wallet address
  usdc_address?: string;
}): Promise<Call[]> {
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
export async function get_payment(payment_ref: string): Promise<PaymentData> {
  const response = await fetch(`/api/payments/initiate?payment_ref=${payment_ref}`);
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
  const contract = new Contract(EGYPTFI_ABI, contract_address, provider);
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