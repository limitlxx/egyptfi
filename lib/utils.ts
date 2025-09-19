import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Contract addresses
export const EGYPT_SEPOLIA_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_EGYPT_SEPOLIA_CONTRACT_ADDRESS || "0x0654d1ab73d517086e44028ba82647e46157657f4c77616ffd3c6cba589240a2";
export const EGYPT_MAINNET_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_EGYPT_MAINNET_CONTRACT_ADDRESS || "0x04bb1a742ac72a9a72beebe1f608c508fce6dfa9250b869018b6e157dccb46e8";