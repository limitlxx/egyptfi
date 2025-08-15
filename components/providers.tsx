"use client";
import { ReactNode } from "react";
import { sepolia } from "@starknet-react/chains";
import {
  StarknetConfig,
  ready,
  braavos,
  useInjectedConnectors,
  jsonRpcProvider,
  voyager,
  paymasterRpcProvider,
} from "@starknet-react/core";
import { headers } from "next/headers";

export function Providers({ children }: { children: ReactNode }) {
  const { connectors } = useInjectedConnectors({
    // Show these connectors if the user has no connector installed.
    recommended: [ready(), braavos()],
    // Hide recommended connectors if the user has any connector installed.
    includeRecommended: "onlyIfNoConnectors",
    // Randomize the order of the connectors.
    order: "alphabetical",
  });
  return (
    <StarknetConfig
      paymasterProvider={paymasterRpcProvider({
        rpc: () => {
          return {
            nodeUrl: "https://sepolia.paymaster.avnu.fi",
            headers: {
              "x-paymaster-api-key":
                process.env.NEXT_PUBLIC_PAYMASTER_API ?? "",
            },
          };
        },
      })}
      chains={[sepolia]}
      provider={jsonRpcProvider({
        rpc: () => ({ nodeUrl: process.env.NEXT_PUBLIC_RPC_URL }),
      })}
      connectors={connectors}
      explorer={voyager}
    >
      {children}
    </StarknetConfig>
  );
}