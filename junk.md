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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { DialogClose } from "@/components/ui/dialog";
import QRCode from "react-qr-code";
import toast from "react-hot-toast";
import { PaymentModeIndicator } from "./PaymentModeIndicator";
import { get_payment, verify_payment } from "@/services/payment";
import { useWallet } from "@/hooks/useWallet";

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
}

interface InvoiceContentProps {
  invoiceData: InvoiceData;
  onPaymentConfirmed?: (paymentRef: string) => void;
  isMobile?: boolean; // Added from previous suggestion
}

export function InvoiceContent({ invoiceData, onPaymentConfirmed, isMobile }: InvoiceContentProps) {
  const [copied, setCopied] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedChain, setSelectedChain] = useState<string>("starknet");
  const [selectedToken, setSelectedToken] = useState<string>("usdc");
  const [convertedAmounts, setConvertedAmounts] = useState<Record<string, string>>({});
  const [isPriceLoading, setIsPriceLoading] = useState(false);
  const [fiatAmount, setFiatAmount] = useState<number | null>(null);
  const router = useRouter();
  const { isConnected, account } = useWallet();

  const chains: Chain[] = [
    { id: "starknet", name: "StarkNet", icon: CircleDotDashed },
    { id: "ethereum", name: "Ethereum", icon: Network },
    { id: "base", name: "Base", icon: CircleDot },
    { id: "arbitrum", name: "Arbitrum", icon: Gem },
    { id: "polygon", name: "Polygon", icon: Wallet },
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
  };

  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });

  const fetchPrice = useCallback(async () => {
    if (!selectedChain || !selectedToken) return;
    if (selectedChain !== "starknet") {
      setError("Price conversion currently only available for Starknet");
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
      setConvertedAmounts(result.data.converted_amount);
      setFiatAmount(result.data.amount_fiat);
    } catch (err) {
      console.error("Price fetch error:", err);
      setError("Failed to update price: " + (err instanceof Error ? err.message : String(err)));
      setConvertedAmounts({});
    } finally {
      setIsPriceLoading(false);
    }
  }, [selectedChain, selectedToken, invoiceData.amount, invoiceData.currency]);

  useEffect(() => {
    fetchPrice();
    const interval = setInterval(fetchPrice, 10000); // Reduced to 10s for demo
    return () => clearInterval(interval);
  }, [fetchPrice]);

  useEffect(() => {
    if (selectedChain && tokens[selectedChain]?.length > 0) {
      setSelectedToken(tokens[selectedChain][0].id);
    } else {
      setSelectedToken("");
    }
  }, [selectedChain]);

  const handlePaidClick = async () => {
    if (!isConnected || !account) {
      toast.error("Please connect wallet first");
      return;
    }
    setIsPolling(true);
    try {
      const isConfirmed = await verify_payment({
        payment_ref: invoiceData.paymentRef,
        contract_address: "0x...contract_address", // Replace with actual address
        wallet: { isConnected, account, address: account?.address || "" },
      });
      if (isConfirmed) {
        setIsPaid(true);
        onPaymentConfirmed?.(invoiceData.paymentRef);
        if (invoiceData.secondaryEndpoint) {
          await fetch(invoiceData.secondaryEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: "payment_confirmed",
              payment_ref: invoiceData.paymentRef,
              status: "paid",
              timestamp: new Date().toISOString(),
            }),
          });
          window.location.href = invoiceData.secondaryEndpoint;
        } else {
          router.push(`/success?ref=${invoiceData.paymentRef}`);
        }
      }
    } catch (err) {
      setError("Failed to verify payment");
    } finally {
      setIsPolling(false);
    }
  };

  const currentTokenData = tokens[selectedChain]?.find((t) => t.id === selectedToken);

  const copyLink = async () => {
    await navigator.clipboard.writeText(invoiceData.payUrl);
    setCopied(true);
    toast.success("Payment link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col">
      <DialogClose className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 hover:bg-gray-200">
        <X className="w-4 h-4" aria-hidden="true" />
        <span className="sr-only">Close</span>
      </DialogClose>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 sm:p-6 lg:p-8 flex-grow">
        <div className="col-span-1 lg:col-span-2 p-4 sm:p-6 lg:p-8">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
            Pay Invoice
          </h2>
          <div className="flex items-center mb-4 sm:mb-6">
            <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg w-12 h-12 flex items-center justify-center text-lg sm:text-xl">
              {invoiceData.merchantLogo ? (
                <img
                  src={invoiceData.merchantLogo}
                  alt="Business logo"
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <span className="text-white">{invoiceData.merchantName[0]}</span>
              )}
            </div>
            <div className="ml-3">
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                {invoiceData.merchantName}
              </h3>
              <p className="text-xs text-gray-500">{invoiceData.invoiceId}</p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex justify-between items-center mb-2 sm:mb-3">
              <span className="text-gray-600 text-sm sm:text-base">Amount</span>
              <span className="text-sm sm:text-base font-bold text-gray-900">
                {invoiceData.amountFiat}
              </span>
            </div>
            {invoiceData.description && (
              <p className="text-xs sm:text-sm text-gray-600">{invoiceData.description}</p>
            )}
          </div>

          <div className="space-y-4">
            {isMobile ? (
              <Button
                variant="default"
                size="sm"
                className="w-full h-8 sm:h-9 bg-gradient-to-r from-green-600 to-blue-600 text-xs sm:text-sm"
                asChild
              >
                <Link href={`/pay?ref=${invoiceData.paymentRef}&redirect=${encodeURIComponent(invoiceData.secondaryEndpoint || "")}`}>
                  <ExternalLink className="w-3 h-3 mr-1" aria-hidden="true" />
                  Open in Wallet
                </Link>
              </Button>
            ) : (
              <>
                <div className="flex justify-center my-4">
                  <QRCode value={invoiceData.payUrl} size={200} />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyLink}
                  className="w-full bg-transparent border-gray-200 h-8 sm:h-9 text-xs sm:text-sm"
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
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full bg-transparent border-gray-200 h-8 sm:h-9 text-xs sm:text-sm"
                  asChild
                >
                  <Link href={`/pay?ref=${invoiceData.paymentRef}&redirect=${encodeURIComponent(invoiceData.secondaryEndpoint || "")}`}>
                    <ExternalLink className="w-3 h-3 mr-1" aria-hidden="true" />
                    Open in Wallet
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="col-span-1 p-4 sm:p-6 lg:p-8">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Order Summary</h2>

          <div className="flex items-center space-x-3 mb-4 sm:mb-6">
            <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg w-12 h-12 flex items-center justify-center text-lg sm:text-xl">
              {invoiceData.merchantLogo ? (
                <img
                  src={invoiceData.merchantLogo}
                  alt="Business logo"
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <span className="text-white">{invoiceData.merchantName[0]}</span>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{invoiceData.merchantName}</h3>
              <p className="text-xs text-gray-500">{invoiceData.invoiceId}</p>
            </div>
          </div>

          {invoiceData.description && (
            <div className="mb-4 sm:mb-6">
              <p className="text-sm text-gray-600">{invoiceData.description}</p>
            </div>
          )}

          <div className="bg-gray-50 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex justify-between items-center mb-2 sm:mb-3">
              <span className="text-gray-600">Amount</span>
              <span className="text-xs sm:text-sm font-bold text-gray-900">
                {formatted.format(fiatAmount || invoiceData.amount)}
              </span>
            </div>
            {currentTokenData && (
              <div className="flex justify-between items-center text-xs sm:text-sm">
                <span className="text-gray-600">You Pay</span>
                <span className="font-medium text-gray-900">
                  ≈ {isPriceLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin inline" />
                  ) : (
                    convertedAmounts[selectedToken.toUpperCase()] || "N/A"
                  )} {currentTokenData.name}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center text-xs sm:text-sm mt-2">
              <span className="text-gray-600">Network</span>
              <span className="font-medium text-gray-900">{chains.find((c) => c.id === selectedChain)?.name}</span>
            </div>
          </div>

          <Button
            className="w-full h-9 sm:h-10 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-sm sm:text-base font-semibold"
            onClick={handlePaidClick}
            disabled={isPolling || isPaid || !convertedAmounts[selectedToken.toUpperCase()]}
            aria-label={isPaid ? "Payment confirmed" : isPolling ? "Waiting for payment confirmation" : "Confirm payment"}
          >
            {isPolling ? (
              <>
 hablando de la animación de carga
                <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-2 animate-spin" aria-hidden="true" />
                Waiting for Payment...
              </>
            ) : isPaid ? (
              <>
                <Check className="w-3 h-3 sm:w-4 sm:h-4 mr-2" aria-hidden="true" />
                Payment Confirmed!
              </>
            ) : (
              "I Have Paid"
            )}
          </Button>

          {isPaid && (
            <div className="mt-3 sm:mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <Check className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 mr-2" aria-hidden="true" />
                <div>
                  <p className="font-medium text-green-900 text-xs sm:text-sm">Payment Confirmed</p>
                  <p className="text-xs text-green-700">Transaction verified on blockchain. Redirecting...</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bottom-0 left-0 right-0 p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-center">
        <PaymentModeIndicator showDetails={false} />
      </div>
    </div>
  );
}