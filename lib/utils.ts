import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Contract addresses
export const EGYPT_SEPOLIA_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_EGYPT_SEPOLIA_CONTRACT_ADDRESS || "0x0654d1ab73d517086e44028ba82647e46157657f4c77616ffd3c6cba589240a2";
export const EGYPT_MAINNET_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_EGYPT_MAINNET_CONTRACT_ADDRESS || "0x04bb1a742ac72a9a72beebe1f608c508fce6dfa9250b869018b6e157dccb46e8";

export function parseStarknetError(err: any): string {
  if (!err) return "Unknown Starknet error";

  try {
    const text = typeof err === "string" ? err : JSON.stringify(err, null, 2);

    // Try to extract all quoted text (Starknet revert reasons are often single-quoted)
    const matches = text.match(/'([^']+)'/g)?.map(m => m.replace(/'/g, ""));

    if (matches && matches.length) {
      // Look for meaningful revert phrases
      const meaningful = matches.find(m =>
        !m.startsWith("0x") &&
        !m.toLowerCase().includes("multicall") &&
        !m.toLowerCase().includes("entrypoint") &&
        m.length > 3
      );
      if (meaningful) return meaningful;
    }

    // Try to extract from known keys
    const parsed = JSON.parse(text);
    if (parsed?.execution_error?.error) {
      const errMsg = parsed.execution_error.error;
      const inner = errMsg.match(/'([^']+)'/g)?.map((s:any) => s.replace(/'/g, ""));
      const real = inner?.find((i:any) =>
        i && !i.startsWith("0x") && !i.toLowerCase().includes("multicall")
      );
      if (real) return real;
    }
  } catch (parseErr) {
    console.warn("Error parsing Starknet error:", parseErr);
  }

  // Fallback to generic message
  return err?.message || "Internal Starknet error";
}
