import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

import { RpcProvider } from "starknet";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export const myProvider = new RpcProvider({
  nodeUrl: process.env.NEXT_PUBLIC_RPC_URL,
});

export const EGYPT_SEPOLIA_CONTRACT_ADDRESS =
  "0x02680191ae87ed05ee564c8e468495c760ba1764065de451fe51bb097e64d062";