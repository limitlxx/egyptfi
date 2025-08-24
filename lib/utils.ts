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
  "0x04bb1a742ac72a9a72beebe1f608c508fce6dfa9250b869018b6e157dccb46e8";