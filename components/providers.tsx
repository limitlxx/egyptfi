"use client";
import { ReactNode } from "react";
import { sepolia, mainnet } from "@starknet-react/chains";
import {
  StarknetConfig,
  jsonRpcProvider,
  voyager,
  paymasterRpcProvider,
} from "@starknet-react/core";
import { availableConnectors } from "@/connectors";
import { ThemeProvider } from "@/components/theme-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange={false}
    >
      <StarknetConfig
        chains={[sepolia, mainnet]}
        paymasterProvider={paymasterRpcProvider({
          rpc: (chain) => {
            return {
              nodeUrl: chain.id === mainnet.id
              ? process.env.NEXT_PUBLIC_PAYMASTER_URL_MAINNET || "https://starknet.paymaster.avnu.fi"
              : process.env.NEXT_PUBLIC_PAYMASTER_URL || "https://sepolia.paymaster.avnu.fi",
              headers: {
                "x-paymaster-api-key":
                  process.env.NEXT_PUBLIC_PAYMASTER_API ?? "",
              },
            };
          },
        })}
        provider={jsonRpcProvider({
          rpc: (chain) => ({
            nodeUrl: chain.id === mainnet.id
            ? process.env.NEXT_PUBLIC_RPC_URL_MAINNET || "https://starknet-mainnet.public.blastapi.io"
            : process.env.NEXT_PUBLIC_RPC_URL || "https://starknet-sepolia.public.blastapi.io"
          }),
        })}
        connectors={availableConnectors}
        explorer={voyager}
      >
        {children}
      </StarknetConfig>
    </ThemeProvider>
  );
}