// lib/starknetService.ts
import {
  Account,
  ec,
  json,
  Provider,
  RpcProvider,
  CallData,
  shortString,
  Contract,
  PaymasterDetails,
} from "starknet";
import { cairo } from "starknet"; // For uint256
import pool from "@/lib/db"; // Your DB pool
import crypto from "crypto"; // For decryption
import { EGYPT_MAINNET_CONTRACT_ADDRESS as CONTRACT_ADDRESS, parseStarknetError } from "@/lib/utils"; // Or mainnet
import { EGYPTFI_ABI } from "@/lib/abi"; // Your ABI
import { getSponsorActivity } from "@/services/paymasterService"; // Reuse your paymaster credits fetch

const DECIMALS = 6; // USDC decimals
const RPC_URL =
  process.env.STARKNET_RPC_URL || "https://starknet-rpc.starknet.io"; // Configurable
const PAYMASTER_URL = "https://starknet.api.avnu.fi/paymaster/v1"; // AVNU paymaster
const PAYMASTER_API_KEY = process.env.NEXT_PUBLIC_PAYMASTER_API; // From env

// Helper: Scale amount to uint256
export const scaleAmountToUint256 = (amountStr: string) => {
  const scaled = BigInt(Math.round(Number(amountStr) * 10 ** DECIMALS));
  const u = cairo.uint256(scaled);
  return { low: u.low.toString(), high: u.high.toString() };
};

// Helper: Get paymaster details (sponsored or default based on credits)
export const getPaymasterDetails: any = async (
  merchantId: string
): Promise<{ feeMode: any; maxFee?: string }> => {
  try {
    // Fetch credits (adapt from usePaymasterCredits)
    const activity = await getSponsorActivity({
      apiKey: PAYMASTER_API_KEY,
      baseUrl: PAYMASTER_URL,
    });

    console.log("Paymaster activity:", activity);

    // Check if API call failed
    if (
      activity.status === "api_error" ||
      activity.status === "fetch_error" ||
      activity.status === "no_api_key"
    ) {
      console.warn("Paymaster unavailable, falling back to default fee mode");
      const gasToken =
        "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"; // STRK
      return {
        feeMode: { mode: "default", gasToken },
      };
    }

    // Parse hex to decimal (wei -> ETH/STRK)
    const parseCredits = (hexStr: string): number => {
      if (!hexStr || hexStr === "0x0") return 0;
      try {
        const bigIntValue = BigInt(hexStr);
        return Number(bigIntValue) / 1e18; // Divide by 10^18 for human-readable ETH/STRK
      } catch (e) {
        console.warn(`Failed to parse credits ${hexStr}:`, e);
        return 0;
      }
    };

    const ethCredits = parseCredits(activity.remainingCredits || "0x0");
    const strkCredits = parseCredits(activity.remainingStrkCredits || "0x0");

    console.log(`Parsed credits - ETH: ${ethCredits}, STRK: ${strkCredits}`);
    const hasCredits = ethCredits > 0.001 || strkCredits > 1.0;

    console.log("Paymaster credits:", { ethCredits, strkCredits, hasCredits });

    if (hasCredits) {
      return {
        feeMode: { mode: "sponsored" },
      };
    } else {
      const gasToken =
        "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"; // STRK
      return {
        feeMode: { mode: "default", gasToken },
      };
    }
  } catch (error) {
    console.error("Error in getPaymasterDetails:", error);
    // Fallback to default fee mode on any error
    const gasToken =
      "0x04718f5a0Fc34cC1AF16A1cdee98fFB20C31f5cD61D6Ab07201858f4287c938D"; // STRK Sepolia
    return {
      feeMode: { mode: "default", gasToken },
    };
  }
};

// Modular: Create Transaction (e.g., create_payment)
export async function createTransaction(
  merchantId: string,
  entrypoint: string,
  calldata: string[] // Raw args: [merchantAddress, amountStr, '0', paymentRef, description]
): Promise<any> {
  const client = await pool.connect();
  try {
    // Fetch merchant data
    const merchantQuery = await client.query(
      "SELECT wallet_public_key, wallet_encrypted_private_key FROM merchants WHERE id = $1",
      [merchantId]
    );
    const merchant = merchantQuery.rows[0];
    if (!merchant) throw new Error("Merchant not found");

    // Decrypt private key
    const publicKey = process.env.WALLET_ADDRESS || merchant.wallet_public_key;
    const privateKey =
      process.env.WALLET_SECRET_KEY || merchant.wallet_encrypted_private_key;
    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    const account = new Account({
      provider: provider,
      address: publicKey,
      signer: privateKey,
    });

    console.log("Provider and account set up", account.address);
    console.log("Calldata:", calldata);

    const calls = [
      {
        contractAddress: CONTRACT_ADDRESS,
        entrypoint,
        calldata, // Use raw calldata for flexibility
      },
    ];

    // Get paymaster details (now handles errors gracefully)
    const { feeMode } = await getPaymasterDetails(merchantId);

    console.log("Executing transaction with feeMode:", feeMode);

    const feesDetails: PaymasterDetails = {
      // feeMode: { mode: 'default', gasToken },
      feeMode,
    };

    // Estimate and execute
    const feeEstimate = await account.estimatePaymasterTransactionFee(
      calls,
      feesDetails
    );

    console.log("Estimated fee:", feeEstimate);

    const { transaction_hash } = await account.executePaymasterTransaction(
      calls,
      feesDetails,
      feeEstimate.suggested_max_fee_in_gas_token
    );

    console.log("Transaction hash:", transaction_hash);

    // Wait for confirmation
    const receipt = await provider.waitForTransaction(transaction_hash);
    console.log("Transaction receipt:", receipt);

    return { transaction_hash };
  } finally {
    client.release();
  }
}

// Modular: Read Contract State (e.g., get_payment)
export async function readContractState(
  entrypoint: string,
  calldata: string[] // e.g., [paymentRef]
): Promise<any> {
  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const contract = new Contract({
    address: CONTRACT_ADDRESS,
    abi: EGYPTFI_ABI,
  });
  contract.connect(provider);
  const result = await contract.call(entrypoint, calldata);
  return result; // e.g., { status: 'Completed' }
}

// Modular: Normal Read Call (using Contract meta-class)
export async function callContractFunction(
  merchantId: string,
  contractAddress: string = CONTRACT_ADDRESS,
  entrypoint: string,
  calldata: string[] // e.g., [paymentRef]
): Promise<any> {
  const client = await pool.connect();
  try {
    // Fetch merchant data (for address; private key not needed for reads)
    const merchantQuery = await client.query(
      "SELECT wallet_address FROM merchants WHERE id = $1",
      [merchantId]
    );
    const merchant = merchantQuery.rows[0];
    if (!merchant) throw new Error("Merchant not found");

    const publicKey = process.env.WALLET_ADDRESS || merchant.wallet_public_key;
    const privateKey =
      process.env.WALLET_SECRET_KEY || merchant.wallet_encrypted_private_key;
    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    const account = new Account({
      provider: provider,
      address: publicKey,
      signer: privateKey,
    });

    // Use imported ABI (or fetch dynamically if needed)

    const { abi: EGYPTFI_ABI } = await provider.getClassAt(CONTRACT_ADDRESS);
    if (EGYPTFI_ABI === undefined) {
      throw new Error("no abi.");
    }

    const contract = new Contract({
      address: CONTRACT_ADDRESS,
      abi: EGYPTFI_ABI,
    });

    // Call the function (read-only)
    const result = await contract.call(entrypoint, calldata);
    console.log(`Read result for ${entrypoint}:`, result);

    return result;
  } finally {
    client.release();
  }
}

// Modular: Normal Write Call (using Contract meta-class with populate/invoke)
export async function invokeContractFunction(
  merchantId: string,
  contractAddress: string = CONTRACT_ADDRESS,
  entrypoint: string,
  args: any[], // Raw args for the function (e.g., [amount, paymentRef])
  pin?: string // Optional PIN for decryption (if not using env vars)
): Promise<{ transaction_hash: string }> {
  const client = await pool.connect();
  try {
    // Fetch merchant data
    const merchantQuery = await client.query(
      "SELECT wallet_address, wallet_encrypted_private_key FROM merchants WHERE id = $1",
      [merchantId]
    );
    const merchant = merchantQuery.rows[0];
    if (!merchant) throw new Error("Merchant not found");

    // Decrypt private key (if PIN provided; fallback to env)
    const publicKey = process.env.WALLET_ADDRESS || merchant.wallet_public_key;
    const privateKey =
      process.env.WALLET_SECRET_KEY || merchant.wallet_encrypted_private_key;
    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    const account = new Account({
      provider: provider,
      address: publicKey,
      signer: privateKey,
    });

    // Use imported ABI (or fetch dynamically if needed)
    const { abi: EGYPTFI_ABI } = await provider.getClassAt(CONTRACT_ADDRESS);
    if (EGYPTFI_ABI === undefined) {
      throw new Error("no abi.");
    }

    const contract = new Contract({
      abi: EGYPTFI_ABI,
      address: CONTRACT_ADDRESS,
      providerOrAccount: provider,
    });

    console.log("Contract and account set up", account.address);
    console.log("contract address:", contract.address);

    // Pre-execute: Fetch merchant state via get_merchant to verify is_active
    const merchantAddress = args[0]; // Assuming first arg is merchant address for create_payment
    console.log("Fetching merchant state for address:", merchantAddress);
    const merchantState = await contract.get_merchant([merchantAddress]);
    console.log("Merchant state from SC:", merchantState);
    
    // Assuming merchantState is a tuple like [is_active, other_fields...]; adjust based on ABI
    const isActive = merchantState[0]; // e.g., first field is is_active (felt: 1 for true)
    if (isActive !== 1) {
      throw new Error(`Merchant not active: is_active=${isActive}. Register/activate merchant first.`);
    }
    console.log("Merchant verified as active; proceeding with execute...");

    const invokeResult = await account.execute({
      contractAddress: CONTRACT_ADDRESS,
      entrypoint,
      calldata: CallData.compile(args),
    });
    console.log(`Execute result for ${entrypoint}:`, invokeResult);
    await provider.waitForTransaction(invokeResult.transaction_hash);

    // contract.connect(account);

    // const contract = new Contract({
    //     address: CONTRACT_ADDRESS,
    //     abi: EGYPTFI_ABI,
    // });
    // contract.connect(provider);
    // await contract.connect(account); // Connect account for signing

    // Prepare and invoke the function
    // const populated = contract.populate(entrypoint, args);
    // console.log(`Populated calldata for ${entrypoint}:`, populated.calldata);

    // const invokeResult = await contract[entrypoint](populated.calldata);
    // console.log(`Invoke result for ${entrypoint}:`, invokeResult);

    // Wait for confirmation
    // const receipt = await provider.waitForTransaction(invokeResult.transaction_hash);
    // if (receipt.status !== 'ACCEPTED') {
    //   throw new Error(`Transaction failed: ${receipt.status}`);
    // }

    console.log(`Transaction confirmed: ${invokeResult.transaction_hash}`);
    return { transaction_hash: invokeResult.transaction_hash };
  } catch (err: any) {
    console.error("Payment initiation error:", err);

    // Default fallback
    let message = "Internal server error";

    // Check if Starknet RPC wrapped the revert reason
    if (
      err?.message?.includes("RpcError") ||
      err?.message?.includes("execution_error")
    ) {
      try {
        const match = JSON.stringify(err).match(/'(.*?)'/g);
        if (match && match.length > 0) {
          // Extract readable text (revert reason usually inside single quotes)
          const readable = match
            .map((s) => s.replace(/'/g, ""))
            .find((s) => s && !s.startsWith("0x") && s.length > 3);
          if (readable) message = readable;
        }
      } catch (parseErr) {
        console.warn("Could not extract Starknet revert reason:", parseErr);
      }
    }

    const parsed = parseStarknetError(err);

    // Log structured debug info for developers
    console.group("🔍 Starknet Payment Debug Info");
  console.error("Raw error:", err);
  console.error("Parsed reason:", parsed);
  console.groupEnd();

    throw new Error(parsed);
  } finally {
    client.release();
  }
}

// Example Usage:
// Read: await callContractFunction(merchantId, undefined, 'get_payment', [paymentRef]);
// Write: await invokeContractFunction(merchantId, undefined, 'create_payment', [merchantAddress, amount, '0', paymentRef, description]);
