// components/invoice-content.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { DialogClose } from "@/components/ui/dialog"
import { PaymentModeIndicator } from "./PaymentModeIndicator"
import { number } from "zod"

interface Chain {
  id: string
  name: string
  icon: React.ComponentType<{ className?: string }>
}

interface Token {
  id: string
  name: string
}

interface InvoiceData {
  merchantName: string
  merchantLogo: string
  amountFiat: string
  invoiceId: string
  paymentRef: string
  hostedUrl: string
  qrCode?: string
  description?: string
  secondaryEndpoint?: string
  currency: string
  amount: number
  payUrl: string
  walletUrl: string
}

interface InvoiceContentProps {
  invoiceData: InvoiceData
  onPaymentConfirmed?: (paymentRef: string) => void
}

export function InvoiceContent({ invoiceData, onPaymentConfirmed }: InvoiceContentProps) {
  const [copied, setCopied] = useState(false)
  const [isPaid, setIsPaid] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedChain, setSelectedChain] = useState<string>("starknet")
  const [selectedToken, setSelectedToken] = useState<string>("usdc")
  const [convertedAmounts, setConvertedAmounts] = useState<Record<string, string>>({})
  const [isPriceLoading, setIsPriceLoading] = useState(false)
  const [fiatAmount, setFiatAmount] = useState(null)
  const router = useRouter()

  const chains: Chain[] = [
    { id: "starknet", name: "StarkNet", icon: CircleDotDashed },
    { id: "ethereum", name: "Ethereum", icon: Network },
    { id: "base", name: "Base", icon: CircleDot },
    { id: "arbitrum", name: "Arbitrum", icon: Gem },
    { id: "polygon", name: "Polygon", icon: Wallet },
  ]

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
    maximumFractionDigits: 6,  // keep up to 6 decimals if needed
  });

  // Fetch price from the endpoint
  const fetchPrice = useCallback(async () => {
    if (!selectedChain || !selectedToken) return;

    // Only support starknet for price conversion
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
      
      if (!result.data?.converted_amount) {
        throw new Error("Invalid price data received");
      }
      setConvertedAmounts(result.data.converted_amount);
      setFiatAmount(result.data.amount_fiat)
    } catch (err) {
      console.error("Price fetch error:", err);
      setError("Failed to update price: " + (err instanceof Error ? err.message : String(err)));
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
      setSelectedToken(tokens[selectedChain][0].id);
    } else {
      setSelectedToken("");
    }
  }, [selectedChain]);

  // Polling for payment status
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isPolling) {
      interval = setInterval(async () => {
        try {
          const response = await fetch(`/api/payments/initiate?payment_ref=${invoiceData.paymentRef}`)
          if (!response.ok) {
            setError("Failed to check payment status")
            setIsPolling(false)
            return
          }
          const result = await response.json()
          if (result.data.status === "paid") {
            setIsPaid(true)
            setIsPolling(false)
            onPaymentConfirmed?.(invoiceData.paymentRef)

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
                    token_amount: convertedAmounts[selectedToken.toUpperCase()] || "0",
                    timestamp: new Date().toISOString(),
                  }),
                })
              } catch (error) {
                console.error("Failed to notify secondary endpoint:", error)
              }
            }

            setTimeout(() => {
              router.push(`/confirm?ref=${invoiceData.paymentRef}`)
            }, 2000)
          }
        } catch (error) {
          console.error("Error polling payment status:", error)
          setError("Failed to verify payment")
          setIsPolling(false)
        }
      }, 3000)
    }
    return () => clearInterval(interval)
  }, [isPolling, invoiceData.paymentRef, invoiceData.secondaryEndpoint, selectedChain, selectedToken, convertedAmounts, router, onPaymentConfirmed])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(invoiceData.payUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      setError("Failed to copy payment link")
    }
  }

  const handlePaidClick = () => {
    setIsPolling(true)
    setError(null)
  }

  const currentTokenData = tokens[selectedChain as keyof typeof tokens]?.find((t) => t.id === selectedToken)

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

      <div className="grid grid-cols-1 lg:grid-cols-3 w-full">
        {/* Column 1: Blockchain Selection */}
        <div className="col-span-1 p-4 sm:p-6 lg:p-8 border-b lg:border-b-0 lg:border-r border-gray-100 bg-gray-50">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Pay With</h2>
          <div className="space-y-2">
            {chains.map((chain) => {
              const Icon = chain.icon
              return (
                <Button
                  key={chain.id}
                  variant="outline"
                  className={cn(
                    "w-full justify-start h-9 sm:h-10 text-xs sm:text-sm rounded-md border-gray-200 transition-colors",
                    selectedChain === chain.id && "border-blue-500 ring-2 ring-blue-200 bg-blue-50 text-blue-800",
                  )}
                  onClick={() => setSelectedChain(chain.id)}
                  aria-label={`Select ${chain.name} blockchain`}
                >
                  <Icon className="w-3 h-3 sm:w-4 sm:h-4 mr-2" aria-hidden="true" />
                  {chain.name}
                </Button>
              )
            })}

          </div>
          
        </div>
        

        {/* Column 2: Payment Info */}
        <div className="col-span-1 border-b lg:border-b-0 lg:border-r border-gray-200 p-4 sm:p-6 lg:p-8">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Scan to Pay</h2>

          {/* Token Selection Chips */}
          <div className="flex flex-wrap gap-1 mb-3 sm:mb-4">
            {tokens[selectedChain as keyof typeof tokens]?.map((token) => (
              <Badge
                key={token.id}
                variant="secondary"
                className={cn(
                  "cursor-pointer px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium rounded-full transition-colors",
                  "bg-gray-100 text-gray-700 hover:bg-gray-200",
                  selectedToken === token.id && "bg-blue-500 text-white hover:bg-blue-600",
                )}
                onClick={() => setSelectedToken(token.id)}
                role="button"
                aria-label={`Select ${token.name} token`}
              >
                {token.name} ≈ {isPriceLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin inline" />
                ) : (
                  convertedAmounts[token.id.toUpperCase()] || "N/A"
                )}
              </Badge>
            ))}
          </div>

          {/* QR Code */}
          <div className="bg-white rounded-xl p-3 sm:p-4 border-2 border-dashed border-gray-200 flex justify-center mb-3 sm:mb-4">
            {invoiceData.qrCode ? (
              <img
                src={invoiceData.qrCode}
                alt={`QR code for payment ${invoiceData.paymentRef}`}
                className="w-32 h-32 sm:w-40 sm:h-40 object-contain"
              />
            ) : (
              <div className="w-32 h-32 sm:w-40 sm:h-40 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center">
                <QrCode className="w-16 h-16 sm:w-20 sm:h-20 text-gray-400" aria-hidden="true" />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 sm:space-y-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full bg-transparent border-gray-200 h-8 sm:h-9 text-xs sm:text-sm"
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
            <Button
              variant="outline"
              size="sm"
              className="w-full bg-transparent border-gray-200 h-8 sm:h-9 text-xs sm:text-sm"
              asChild
            >
              <Link href={invoiceData.walletUrl || `/pay?ref=${invoiceData.paymentRef}&redirect=${encodeURIComponent(invoiceData.secondaryEndpoint || "")}`}>
                    <ExternalLink className="w-3 h-3 mr-1" aria-hidden="true" />
                    Open in Wallet
                  </Link>
            </Button>
          </div>
        </div>

        {/* Column 3: Summary & Confirmation */}
        <div className="col-span-1 p-4 sm:p-6 lg:p-8">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Order Summary</h2>

          {/* Merchant Brand */}
          <div className="flex items-center space-x-3 mb-4 sm:mb-6">
            <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg w-12 h-12 flex items-center justify-center text-lg sm:text-xl">
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
                <span className="text-white">{invoiceData.merchantName[0]}</span>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{invoiceData.merchantName}</h3>
              <p className="text-xs text-gray-500">{invoiceData.invoiceId}</p>
            </div>
          </div>

          {/* Description */}
          {invoiceData.description && (
            <div className="mb-4 sm:mb-6">
              <p className="text-sm text-gray-600">{invoiceData.description}</p>
            </div>
          )}

          {/* Amount Details */}
          <div className="bg-gray-50 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex justify-between items-center mb-2 sm:mb-3">
              <span className="text-gray-600">Amount  <br/><strong> {formatted.format(fiatAmount ?? 0)} </strong></span>
              {/* <span className="text-xs sm:text-sm font-bold text-gray-900"></span> */}
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
            {/* <div className="flex justify-between items-center text-xs sm:text-sm mt-2">
              <span className="text-gray-600">Gas Fees</span>
              <span className="font-medium text-green-600">Sponsored</span>
            </div> */}
          </div>

          {/* Confirmation Button */}
          <Button
            className="w-full h-9 sm:h-10 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-sm sm:text-base font-semibold"
            onClick={handlePaidClick}
            disabled={isPolling || isPaid || !convertedAmounts[selectedToken.toUpperCase()]}
            aria-label={isPaid ? "Payment confirmed" : isPolling ? "Waiting for payment confirmation" : "Confirm payment"}
          >
            {isPolling ? (
              <>
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

          {/* Payment Status */}
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
  )
}