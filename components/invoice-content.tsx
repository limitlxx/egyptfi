// components/invoice-content.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ExternalLink,
  Check,
  Loader2,
  Wallet,
  QrCode,
  CircleDot,
  CircleDotDashed,
  Network,
  Gem,
  LinkIcon,
  X,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Copy,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { DialogClose } from "@/components/ui/dialog";
import { PaymentModeIndicator } from "./PaymentModeIndicator";
import { number } from "zod";
import toast from "react-hot-toast";
import { type Connector, useConnect } from "@starknet-react/core";
import { useWallet } from "@/hooks/useWallet";
import {
  type StarknetkitConnector,
  useStarknetkitConnectModal,
} from "starknetkit";
import { availableConnectors } from "@/connectors";
import {
  getProviders,
  getProviderById,
  request,
  AddressPurpose,
} from "@sats-connect/core";

interface Chain {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface Token {
  id: string;
  name: string;
}

interface InvoiceData {
  merchantName: string;
  merchantLogo: string;
  amountFiat: string;
  invoiceId: string;
  paymentRef: string;
  hostedUrl: string;
  qrCode?: string;
  description?: string;
  secondaryEndpoint?: string;
  currency: string;
  amount: number;
  payUrl: string;
  walletUrl: string;
  preferred_btc_flow?: string;
}

interface InvoiceContentProps {
  invoiceData: InvoiceData;
  onPaymentConfirmed?: (paymentRef: string) => void;
}

export function InvoiceContent({
  invoiceData,
  onPaymentConfirmed,
}: InvoiceContentProps) {
  const [copied, setCopied] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedChain, setSelectedChain] = useState<string>("starknet");
  const [selectedToken, setSelectedToken] = useState<string>("usdc");
  const [convertedAmounts, setConvertedAmounts] = useState<
    Record<string, string>
  >({});
  const [isPriceLoading, setIsPriceLoading] = useState(false);
  const [fiatAmount, setFiatAmount] = useState(null);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const router = useRouter();

  const { connectAsync, connectors } = useConnect();
  const { starknetkitConnectModal } = useStarknetkitConnectModal({
    connectors: availableConnectors as StarknetkitConnector[],
  });

  const chains: Chain[] = [
    { id: "starknet", name: "StarkNet", icon: CircleDotDashed },
    { id: "ethereum", name: "Ethereum", icon: Network },
    { id: "base", name: "Base", icon: CircleDot },
    { id: "arbitrum", name: "Arbitrum", icon: Gem },
    { id: "polygon", name: "Polygon", icon: Wallet },
    { id: "bitcoin", name: "Bitcoin", icon: CircleDot },
  ];

  const tokens: Record<string, Token[]> = {
    starknet: [
      { id: "usdc", name: "USDC" },
      { id: "eth", name: "ETH" },
      { id: "strk", name: "STRK" },
    ],
    ethereum: [
      { id: "usdc", name: "USDC" },
      { id: "eth", name: "ETH" },
      { id: "usdt", name: "USDT" },
      { id: "dai", name: "DAI" },
    ],
    base: [
      { id: "usdc", name: "USDC" },
      { id: "eth", name: "ETH" },
    ],
    arbitrum: [
      { id: "usdc", name: "USDC" },
      { id: "eth", name: "ETH" },
    ],
    polygon: [
      { id: "usdc", name: "USDC" },
      { id: "matic", name: "MATIC" },
      { id: "dai", name: "DAI" },
    ],
    bitcoin: [
      { id: "btc-l1", name: "BTC L1" },
      { id: "btc-l2", name: "BTC L2" },
    ],
  };

  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6, // keep up to 6 decimals if needed
  });

  // Fetch price from the endpoint
  const fetchPrice = useCallback(async () => {
    if (!selectedChain || !selectedToken) return;

    // Only support starknet and bitcoin for price conversion
    if (selectedChain !== "starknet" && selectedChain !== "bitcoin") {
      setError(
        "Price conversion currently only available for Starknet and Bitcoin"
      );
      setConvertedAmounts({});
      return;
    }

    try {
      setIsPriceLoading(true);
      setError(null);
      const response = await fetch(
        `/api/payments/price?token=${selectedToken}&chain=${selectedChain}&fiat_amount=${invoiceData.amount}&fiat_currency=${invoiceData.currency}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch price: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.data?.converted_amount) {
        throw new Error("Invalid price data received");
      }
      setConvertedAmounts(result.data.converted_amount);
      setFiatAmount(result.data.amount_fiat);
    } catch (err) {
      console.error("Price fetch error:", err);
      setError(
        "Failed to update price: " +
          (err instanceof Error ? err.message : String(err))
      );
      setConvertedAmounts({});
    } finally {
      setIsPriceLoading(false);
    }
  }, [selectedChain, selectedToken, invoiceData.amount, invoiceData.currency]);

  // Poll price every 10 seconds
  useEffect(() => {
    fetchPrice(); // Initial fetch
    const interval = setInterval(fetchPrice, 600000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, [fetchPrice]);

  // Update selected token when chain changes
  useEffect(() => {
    if (selectedChain && tokens[selectedChain]?.length > 0) {
      if (selectedChain === "bitcoin" && invoiceData.preferred_btc_flow) {
        // Default to merchant's preferred BTC flow
        const preferredToken =
          invoiceData.preferred_btc_flow === "l1" ? "btc-l1" : "btc-l2";
        setSelectedToken(preferredToken);
      } else {
        setSelectedToken(tokens[selectedChain][0].id);
      }
    } else {
      setSelectedToken("");
    }
  }, [selectedChain, invoiceData.preferred_btc_flow]);

  // Polling for payment status
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPolling) {
      interval = setInterval(async () => {
        try {
          const response = await fetch(
            `/api/payments/verify?payment_ref=${invoiceData.paymentRef}`
          );
          if (!response.ok) {
            setError("Failed to check payment status");
            setIsPolling(false);
            return;
          }
          const result = await response.json();
          if (result.data.status === "paid") {
            setIsPaid(true);
            setIsPolling(false);
            onPaymentConfirmed?.(invoiceData.paymentRef);

            // Notify secondary endpoint
            if (invoiceData.secondaryEndpoint) {
              try {
                await fetch(invoiceData.secondaryEndpoint, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    event: "payment_confirmed",
                    payment_ref: invoiceData.paymentRef,
                    amount: invoiceData.amount,
                    currency: invoiceData.currency,
                    chain: selectedChain,
                    token: selectedToken,
                    token_amount:
                      convertedAmounts[selectedToken.toUpperCase()] || "0",
                    timestamp: new Date().toISOString(),
                  }),
                });
              } catch (error) {
                console.error("Failed to notify secondary endpoint:", error);
              }
            }

            setTimeout(() => {
              router.push(`/confirm?ref=${invoiceData.paymentRef}`);
            }, 2000);
          }
        } catch (error) {
          console.error("Error polling payment status:", error);
          setError("Failed to verify payment");
          setIsPolling(false);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [
    isPolling,
    invoiceData.paymentRef,
    invoiceData.secondaryEndpoint,
    selectedChain,
    selectedToken,
    convertedAmounts,
    router,
    onPaymentConfirmed,
  ]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(invoiceData.payUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      setError("Failed to copy payment link");
    }
  };

  const handlePaidClick = () => {
    setIsPolling(true);
    setError(null);
  };

  const handleConnectWallet = async () => {
    if (selectedChain === "starknet") {
      // open internal connector modal which will use starknetkit connectors
      openConnectorModal();
      return;
    }

    if (selectedChain === "bitcoin") {
      try {
        const providers = getProviders();
        if (!providers || providers.length === 0) {
          toast.error(
            "No Sats providers available. Please install Xverse or a compatible provider."
          );
          return;
        }

        const firstProvider = providers[0];
        console.log("Selected sats provider:", firstProvider);
        const xverse = await getProviderById(firstProvider.id);

        if (!xverse) {
          toast.error("Xverse wallet not found. Please install Xverse wallet.");
          return;
        }

        // Try wallet_connect first (preferred flow), fall back to account requests
        let response: any = null;
        try {
          response = await xverse.request("wallet_connect", null);
          console.log("wallet_connect response:", response);
        } catch (err) {
          console.warn(
            "wallet_connect failed, will try fallback account methods:",
            err
          );
        }

        if (response?.status === "success") {
          // Follow up with getAccounts to retrieve addresses
          try {
            const accountsResponse = await request("getAccounts", {
              purposes: [AddressPurpose.Payment, AddressPurpose.Ordinals],
              message: "Connect to EgyptFi",
            });
            console.log("getAccounts response:", accountsResponse);

            if (
              accountsResponse?.status === "success" &&
              accountsResponse.result
            ) {
              const paymentAddressItem = accountsResponse.result.find(
                (address: any) => address.purpose === AddressPurpose.Payment
              );
              const ordinalsAddressItem = accountsResponse.result.find(
                (address: any) => address.purpose === AddressPurpose.Ordinals
              );

              const chosen =
                paymentAddressItem?.address ||
                ordinalsAddressItem?.address ||
                null;
              console.log("chosen address:", chosen);

              if (chosen) {
                setXverseAddress(chosen);
                setXverseProvider(xverse);
                toast.success("Xverse wallet connected successfully");
                return;
              }
            }
          } catch (err) {
            console.error("getAccounts failed:", err);
            toast.error("Failed to connect Xverse wallet");
            return;
          }
        } else {
          // Fallback: try getAccounts directly
          try {
            const accountsResponse = await request("getAccounts", {
              purposes: [AddressPurpose.Payment, AddressPurpose.Ordinals],
              message: "Connect to EgyptFi",
            });
            console.log("getAccounts fallback response:", accountsResponse);

            if (
              accountsResponse?.status === "success" &&
              accountsResponse.result
            ) {
              const paymentAddressItem = accountsResponse.result.find(
                (address: any) => address.purpose === AddressPurpose.Payment
              );
              const ordinalsAddressItem = accountsResponse.result.find(
                (address: any) => address.purpose === AddressPurpose.Ordinals
              );

              const chosen =
                paymentAddressItem?.address ||
                ordinalsAddressItem?.address ||
                null;
              console.log("chosen address from fallback:", chosen);

              if (chosen) {
                setXverseAddress(chosen);
                setXverseProvider(xverse);
                toast.success("Xverse wallet connected successfully");
                return;
              }
            }
          } catch (err) {
            console.error("Xverse connection error:", err);
            toast.error("Failed to connect Xverse wallet");
            return;
          }
        }
      } catch (err) {
        console.error("Xverse connection error:", err);
        toast.error("Failed to connect Xverse wallet");
      }
      return;
    }

    toast.error("Wallet connection not supported for this network");
  };

  const currentTokenData = tokens[selectedChain as keyof typeof tokens]?.find(
    (t) => t.id === selectedToken
  );

  const [showConnectorModal, setShowConnectorModal] = useState(false);
  // Xverse (SATS) connection state (keeps a provider instance and address)
  const [xverseAddress, setXverseAddress] = useState<string | null>(null);
  const [xverseProvider, setXverseProvider] = useState<any | null>(null);

  const {
    address: snAddress,
    isConnected: snIsConnected,
    disconnect: snDisconnect,
    formatAddress,
  } = useWallet();

  const formatShortAddress = (addr: string | null | undefined) => {
    if (!addr) return "";
    // Show 0x + 3 chars then ... then last 4 chars, e.g. 0x312...8990
    const prefix = addr.slice(0, 5);
    const suffix = addr.slice(-4);
    return `${prefix}...${suffix}`;
  };

  const copyXverseAddress = async () => {
    if (xverseAddress) {
      await navigator.clipboard.writeText(xverseAddress);
      toast.success("Address copied to clipboard");
    }
  };

  const openXverseExplorer = () => {
    if (xverseAddress) {
      // Use mempool.space for Bitcoin address exploration
      window.open(`https://mempool.space/address/${xverseAddress}`, "_blank");
    }
  };

  const disconnectXverse = async () => {
    try {
      // Use the proper sats-connect disconnect method
      if (xverseProvider?.request) {
        try {
          await xverseProvider.request("wallet_disconnect", null);
        } catch (e) {
          // Some providers may not support explicit disconnect
          console.warn("Provider doesn't support wallet_disconnect:", e);
        }
      }
    } finally {
      setXverseAddress(null);
      setXverseProvider(null);
      toast.success("Wallet disconnected");
    }
  };

  const openConnectorModal = () => setShowConnectorModal(true);
  const closeConnectorModal = () => setShowConnectorModal(false);

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Error Message */}
      {error && (
        <div className="absolute top-0 left-0 right-0 p-4 bg-red-50 border-b border-red-200 flex items-center justify-center">
          <AlertCircle className="w-4 h-4 text-red-600 mr-2" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Close Button */}
      <DialogClose
        onClick={() => router.back()}
        className="absolute right-3 top-3 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground bg-white/80 backdrop-blur-sm p-1"
        aria-label="Close payment dialog"
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogClose>

      {/* Use responsive flex layout so we can give first column a slightly smaller base width */}
      <div className="w-full flex flex-col lg:flex-row lg:gap-4">
        {/* Column 1: Blockchain Selection (slightly smaller) */}
        <div
          className="p-4 sm:p-6 lg:p-8 border-b lg:border-b-0 lg:border-r border-border bg-muted"
          style={{ flex: "0 0 24%" }}
        >
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-foreground">
              Pay With
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsLeftCollapsed(!isLeftCollapsed)}
              className="p-1"
            >
              {isLeftCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </Button>
          </div>
          <div className="space-y-2">
            {chains.map((chain) => {
              const Icon = chain.icon;
              return (
                <Button
                  key={chain.id}
                  variant="outline"
                  className={cn(
                    "w-full h-9 sm:h-10 text-xs sm:text-sm rounded-md border-border transition-colors",
                    selectedChain === chain.id &&
                      "border-primary ring-2 ring-primary/20 bg-primary/10 text-primary",
                    // when collapsed, center icons and shrink padding
                    isLeftCollapsed ? "justify-center px-0" : "justify-start"
                  )}
                  onClick={() => setSelectedChain(chain.id)}
                  aria-label={`Select ${chain.name} blockchain`}
                >
                  <Icon
                    className={cn(
                      "w-3 h-3 sm:w-4 sm:h-4",
                      !isLeftCollapsed && "mr-2"
                    )}
                    aria-hidden="true"
                  />
                  {!isLeftCollapsed && (
                    <span className="truncate">{chain.name}</span>
                  )}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Column 2: Payment Info */}
        <div
          className="border-b lg:border-b-0 lg:border-r border-border p-4 sm:p-6 lg:p-8"
          style={{ flex: "0 0 38%" }}
        >
          <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">
            Scan to Pay
          </h2>

          {/* Token Selection Chips */}
          <div className="flex flex-wrap gap-1 mb-3 sm:mb-4">
            {tokens[selectedChain as keyof typeof tokens]?.map((token) => (
              <Badge
                key={token.id}
                variant="secondary"
                className={cn(
                  "cursor-pointer px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium rounded-full transition-colors",
                  "bg-muted text-muted-foreground hover:bg-muted/80",
                  selectedToken === token.id &&
                    "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
                onClick={() => setSelectedToken(token.id)}
                role="button"
                aria-label={`Select ${token.name} token`}
              >
                {token.name} ≈{" "}
                {isPriceLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin inline" />
                ) : (
                  convertedAmounts[token.id.toUpperCase()] || "N/A"
                )}
              </Badge>
            ))}
          </div>

          {/* QR Code */}
          <div className="bg-card rounded-xl p-3 sm:p-4 border-2 border-dashed border-border flex justify-center mb-3 sm:mb-4">
            {invoiceData.qrCode ? (
              <img
                src={invoiceData.qrCode}
                alt={`QR code for payment ${invoiceData.paymentRef}`}
                className="w-32 h-32 sm:w-40 sm:h-40 object-contain"
              />
            ) : (
              <div className="w-32 h-32 sm:w-40 sm:h-40 bg-gradient-to-br from-primary/10 to-yellow-600/10 rounded-lg flex items-center justify-center">
                <QrCode
                  className="w-16 h-16 sm:w-20 sm:h-20 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 sm:space-y-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full bg-transparent border-border h-8 sm:h-9 text-xs sm:text-sm"
              onClick={copyLink}
              aria-label={copied ? "Payment link copied" : "Copy payment link"}
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 mr-1" aria-hidden="true" />
                  Copied!
                </>
              ) : (
                <>
                  <LinkIcon className="w-3 h-3 mr-1" aria-hidden="true" />
                  Copy Payment Link
                </>
              )}
            </Button>
            {/* Connect / Connected button: show connected address and disconnect on click */}
            {selectedChain === "bitcoin" ? (
              xverseAddress ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="w-full bg-transparent border-border h-8 sm:h-9 text-xs sm:text-sm opacity-75"
                  >
                    <Wallet className="w-3 h-3 mr-1" aria-hidden="true" />
                    {formatShortAddress(xverseAddress)}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full bg-transparent border-border h-8 sm:h-9 text-xs sm:text-sm"
                    onClick={disconnectXverse}
                  >
                    <LogOut className="w-3 h-3 mr-1" aria-hidden="true" />
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full bg-transparent border-border h-8 sm:h-9 text-xs sm:text-sm"
                  onClick={handleConnectWallet}
                >
                  <Wallet className="w-3 h-3 mr-1" aria-hidden="true" />
                  Connect Wallet
                </Button>
              )
            ) : // Starknet connect button / connected address
            snIsConnected && snAddress ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full bg-transparent border-border h-8 sm:h-9 text-xs sm:text-sm"
                onClick={async () => {
                  try {
                    await snDisconnect();
                  } catch (err) {
                    console.error("Disconnect error:", err);
                  }
                }}
              >
                <Wallet className="w-3 h-3 mr-1" aria-hidden="true" />
                {formatShortAddress(snAddress)}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full bg-transparent border-border h-8 sm:h-9 text-xs sm:text-sm"
                onClick={handleConnectWallet}
              >
                <Wallet className="w-3 h-3 mr-1" aria-hidden="true" />
                Connect Wallet
              </Button>
            )}
          </div>
        </div>

        {/* Column 3: Summary & Confirmation */}
        <div className="p-4 sm:p-6 lg:p-8" style={{ flex: "0 0 38%" }}>
          <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">
            Order Summary
          </h2>

          {/* Merchant Brand */}
          <div className="flex items-center space-x-3 mb-4 sm:mb-6">
            <div className="bg-gradient-to-br from-primary to-yellow-600 rounded-lg w-12 h-12 flex items-center justify-center text-lg sm:text-xl">
              {invoiceData.merchantLogo ? (
                <img
                  src={invoiceData.merchantLogo}
                  alt="Business logo"
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : typeof invoiceData.merchantLogo === "string" &&
                invoiceData.merchantLogo.startsWith("/") ? (
                <img
                  src={invoiceData.merchantLogo}
                  alt="Business logo"
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <span className="text-primary-foreground">
                  {invoiceData.merchantName[0]}
                </span>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm sm:text-base">
                {invoiceData.merchantName}
              </h3>
              <p className="text-xs text-muted-foreground">
                {invoiceData.invoiceId}
              </p>
            </div>
          </div>

          {/* Description */}
          {invoiceData.description && (
            <div className="mb-4 sm:mb-6">
              <p className="text-sm text-muted-foreground">
                {invoiceData.description}
              </p>
            </div>
          )}

          {/* Amount Details */}
          <div className="bg-muted rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex justify-between items-center mb-2 sm:mb-3">
              <span className="text-muted-foreground">
                Amount <br />
                <strong> {formatted.format(fiatAmount ?? 0)} </strong>
              </span>
              {/* <span className="text-xs sm:text-sm font-bold text-foreground"></span> */}
            </div>
            {currentTokenData && (
              <div className="flex justify-between items-center text-xs sm:text-sm">
                <span className="text-muted-foreground">You Pay</span>
                <span className="font-medium text-foreground">
                  ≈{" "}
                  {isPriceLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin inline" />
                  ) : (
                    convertedAmounts[selectedToken.toUpperCase()] || "N/A"
                  )}{" "}
                  {currentTokenData.name}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center text-xs sm:text-sm mt-2">
              <span className="text-muted-foreground">Network</span>
              <span className="font-medium text-foreground">
                {chains.find((c) => c.id === selectedChain)?.name}
              </span>
            </div>
            {/* <div className="flex justify-between items-center text-xs sm:text-sm mt-2">
              <span className="text-muted-foreground">Gas Fees</span>
              <span className="font-medium text-green-600">Sponsored</span>
            </div> */}
          </div>

          {/* Confirmation Button */}
          <Button
            className="w-full h-9 sm:h-10 bg-gradient-to-r from-primary to-yellow-600 hover:from-primary/90 hover:to-yellow-600/90 text-sm sm:text-base font-semibold"
            onClick={handlePaidClick}
            disabled={
              isPolling ||
              isPaid ||
              !convertedAmounts[selectedToken.toUpperCase()]
            }
            aria-label={
              isPaid
                ? "Payment confirmed"
                : isPolling
                ? "Waiting for payment confirmation"
                : "Confirm payment"
            }
          >
            {isPolling ? (
              <>
                <Loader2
                  className="w-3 h-3 sm:w-4 sm:h-4 mr-2 animate-spin"
                  aria-hidden="true"
                />
                Waiting for Payment...
              </>
            ) : isPaid ? (
              <>
                <Check
                  className="w-3 h-3 sm:w-4 sm:h-4 mr-2"
                  aria-hidden="true"
                />
                Payment Confirmed!
              </>
            ) : (
              "I Have Paid"
            )}
          </Button>

          {/* Payment Status */}
          {isPaid && (
            <div className="mt-3 sm:mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <Check
                  className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 mr-2"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-medium text-green-900 text-xs sm:text-sm">
                    Payment Confirmed
                  </p>
                  <p className="text-xs text-green-700">
                    Transaction verified on blockchain. Redirecting...
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bottom-0 left-0 right-0 p-4 bg-muted border-b border-border flex items-center justify-center">
        <PaymentModeIndicator showDetails={false} />
      </div>
      {/* Connector Modal Overlay */}
      {showConnectorModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onMouseDown={(e) => {
            // close when clicking outside the modal content
            if (
              (e.target as HTMLElement).dataset?.role === "connector-overlay"
            ) {
              closeConnectorModal();
            }
          }}
          data-role="connector-overlay"
        >
          <div
            className="absolute inset-0 bg-black/40"
            data-role="connector-overlay"
          />
          <div
            className="relative z-60 w-full max-w-md mx-4 bg-primary-foreground text-secondary-foreground rounded-lg shadow-lg p-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg text-primary font-semibold">
                Connect Wallet
              </h3>
              <Button variant="ghost" size="sm" onClick={closeConnectorModal}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {availableConnectors.map((c: any, idx: number) => (
                <Button
                  key={idx}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={async () => {
                    try {
                      // starknetkit connectors expose connector object or factory
                      const connector = c;
                      await connectAsync({ connector: connector as Connector });
                      toast.success("Wallet connected");
                      closeConnectorModal();
                    } catch (err) {
                      console.error("Connector open error:", err);
                      toast.error("Failed to connect");
                    }
                  }}
                >
                  {c.options?.id || c.name || `Connector ${idx + 1}`}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
