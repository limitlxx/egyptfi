// hooks/usePayment.ts (new file)
import { useState } from "react";
import { useAccount } from "@starknet-react/core";
import { CallData, uint256 } from "starknet";
import toast from "react-hot-toast";
import { EGYPT_MAINNET_CONTRACT_ADDRESS } from "@/lib/utils"; // Adjust imports
import { EGYPTFI_ABI } from "@/lib/abi";

type Token = "usdc" | "eth" | "strk" | "wbtc";

const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS!; // Add to .env
const ETH_ADDRESS =
  "0x049D36570D4e46f48e99674bd3fcc84644DdD6b96F7C741B1562B82f9e004dC7"; // Add ETH contract address to .env/utils if needed
const STRK_ADDRESS =
  "0x04718f5a0Fc34cC1AF16A1cdee98fFB20C31f5cD61D6Ab07201858f4287c938D";

  const WBTC_ADDRESS = "0x03fe2b97c1fd336e75087d1b9b9dc081adf2b28dc242f9bebed4edff6842"; // Actual WBTC Starknet address; 8 decimals

// Token-specific decimals
const DECIMALS: Record<Token, number> = {
  usdc: 6,
  eth: 18,
  strk: 18,
  wbtc: 8,
};

const TOKEN_ADDRESSES: Record<Token, string> = {
  usdc: USDC_ADDRESS,
  eth: ETH_ADDRESS,
  strk: STRK_ADDRESS,
  wbtc: WBTC_ADDRESS,
};

const AUTOSWAPPR_CONTRACT = process.env.NEXT_PUBLIC_AUTOSWAPPR_CONTRACT_ADDRESS!; // Public for frontend

// Minimal ERC20 ABI snippet for approve/allowance
const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "ContractAddress" },
      { name: "amount", type: "Uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "non-view", // Note: non-view for write
  },
  {
    name: "allowance",
    type: "function",
    inputs: [
      { name: "owner", type: "ContractAddress" },
      { name: "spender", type: "ContractAddress" },
    ],
    outputs: [{ type: "Uint256" }],
    stateMutability: "view",
  },
];

export const usePayment = (invoiceData: any) => {
  // Pass invoiceData for ref/amount
  const [isProcessing, setIsProcessing] = useState(false);
  const { address, account } = useAccount();

const processStarknetPayment = async (
    selectedToken: Token,
  convertedAmount: string
) => {
    console.log("Processing Starknet payment:", { selectedToken, convertedAmount, invoiceData });
    
  if (!account || !address) {
    toast.error("Connect Starknet wallet");
    return { success: false };
  }

  setIsProcessing(true);
  try {
      const tokenAddress = TOKEN_ADDRESSES[selectedToken];
      const decimals = DECIMALS[selectedToken];
    const amountBn = BigInt(
      Math.round(parseFloat(convertedAmount) * 10 ** decimals)
    );
    const amountUint = uint256.bnToUint256(amountBn);
    const paymentId = invoiceData.paymentId; // From create_payment

    console.log(`Processing payment of ${convertedAmount} ${selectedToken.toUpperCase()} (raw: ${amountBn}) for payment ID ${paymentId}`);
    console.log("Using token address:", tokenAddress);

    if (!tokenAddress) {
      toast.error("Unsupported token");
      return { success: false };
    }    

      const calls: Array<any> = [];

      if (selectedToken !== "usdc") {
        // Non-USDC: Approve to AutoSwappr + manual_swap + approve USDC (max) + process_payment

        // Approve input token to AutoSwappr
        calls.push({
          contractAddress: tokenAddress,
          entrypoint: "approve",
          calldata: CallData.compile([AUTOSWAPPR_CONTRACT, amountUint.low, amountUint.high]),
        });

        // manual_swap call (assumed calldata based on SDK params; adjust if needed)
        const isToken1 = BigInt(tokenAddress) > BigInt(USDC_ADDRESS) ? 1 : 0; // Lexical order
        const skipAhead = 0; // Assume 0; could be slippage/deadline
        calls.push({
          contractAddress: AUTOSWAPPR_CONTRACT,
          entrypoint: "manual_swap",
          calldata: CallData.compile([
            tokenAddress, // fromToken
            USDC_ADDRESS, // toToken
            amountUint.low,
            amountUint.high,
            isToken1,
            skipAhead,
          ]),
        });
      } else {
        // For USDC: Check/Approve token
    const allowanceCall = {
      contractAddress: tokenAddress,
      entrypoint: "allowance",
      calldata: CallData.compile([address, EGYPT_MAINNET_CONTRACT_ADDRESS]),
    };
    const allowanceResult = await account.callContract(allowanceCall);
    console.log("Allowance result:", allowanceResult);
    
    const currentAllowance = uint256.uint256ToBN({
      low: BigInt(allowanceResult[0]),
      high: BigInt(allowanceResult[1]),
    });
 
    if (currentAllowance < amountBn) {
      toast("Approving tokens...");

      console.log("amountUint:", amountUint.low, amountUint.high);
      console.log("amountBn:", amountBn);
      console.log("Current allowance:", currentAllowance);

      // Approve Egypt contract to spend tokens     

      const approveCall = {
        contractAddress: tokenAddress,
        entrypoint: "approve",
        calldata: CallData.compile([
          EGYPT_MAINNET_CONTRACT_ADDRESS,
          amountUint.low,
          amountUint.high,
        ]),
      };
          calls.push(approveCall);
        }
      }

      // Approve USDC max for process (even for USDC, if not already)
      const maxUint = uint256.bnToUint256(BigInt(2 ** 256 - 1));
      calls.push({
        contractAddress: USDC_ADDRESS,
        entrypoint: "approve",
        calldata: CallData.compile([EGYPT_MAINNET_CONTRACT_ADDRESS, maxUint.low, maxUint.high]),
      });

    // 2. Call process_payment on Egypt contract
      calls.push({
      contractAddress: EGYPT_MAINNET_CONTRACT_ADDRESS,
      entrypoint: "process_payment",
        calldata: CallData.compile([paymentId]),
      });

      toast("Executing payment...");
      console.log("PAYMENT ID", paymentId);    

      const { transaction_hash } = await account.execute(calls);

    await account.waitForTransaction(transaction_hash);

    toast.success("Payment deposited to contract!");

    return { success: true, txHash: transaction_hash };
  } catch (error: any) {
    toast.error(error.message || "Payment failed");
    return { success: false, error: error.message };
  } finally {
    setIsProcessing(false);
  }
};

  return { processStarknetPayment, isProcessing };
};
