"use client"

import { useState, useEffect } from "react"
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { DialogClose } from "@/components/ui/dialog" // Import DialogClose

export function InvoiceContent() {
  const [copied, setCopied] = useState(false)
  const [isPaid, setIsPaid] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [selectedChain, setSelectedChain] = useState("ethereum")
  const [selectedToken, setSelectedToken] = useState("usdc")
  const router = useRouter()

  const invoiceData = {
    merchantName: "TheBuidl Kitchen, Kaduna",
    merchantLogo: "☕",
    amountFiat: "₦500,000",
    invoiceId: "INV-2025-001",
  }

  const chains = [
    { id: "ethereum", name: "Ethereum", icon: Network },
    { id: "starknet", name: "StarkNet", icon: CircleDotDashed },
    { id: "base", name: "Base", icon: CircleDot },
    { id: "arbitrum", name: "Arbitrum", icon: Gem },
    { id: "polygon", name: "Polygon", icon: Wallet },
  ]

  const tokens = {
    ethereum: [
      { id: "usdc", name: "USDC", amount: "3.2" },
      { id: "eth", name: "ETH", amount: "0.0013" },
      { id: "usdt", name: "USDT", amount: "3.2" },
      { id: "dai", name: "DAI", amount: "3.18" },
    ],
    starknet: [
      { id: "usdc", name: "USDC", amount: "3.2" },
      { id: "eth", name: "ETH", amount: "0.0013" },
    ],
    base: [
      { id: "usdc", name: "USDC", amount: "3.2" },
      { id: "eth", name: "ETH", amount: "0.0013" },
    ],
    arbitrum: [
      { id: "usdc", name: "USDC", amount: "3.2" },
      { id: "eth", name: "ETH", amount: "0.0013" },
    ],
    polygon: [
      { id: "usdc", name: "USDC", amount: "3.2" },
      { id: "matic", name: "MATIC", amount: "4.1" },
      { id: "dai", name: "DAI", amount: "3.18" },
    ],
  }

  useEffect(() => {
    if (selectedChain && tokens[selectedChain as keyof typeof tokens]?.length > 0) {
      setSelectedToken(tokens[selectedChain as keyof typeof tokens][0].id)
    } else {
      setSelectedToken("")
    }
  }, [selectedChain])

  const copyLink = async () => {
    const mockPaymentLink = `https://pay.nummus.xyz/invoice/${invoiceData.invoiceId}`
    await navigator.clipboard.writeText(mockPaymentLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePaidClick = () => {
    setIsPolling(true)
    setTimeout(() => {
      setIsPaid(true)
      setIsPolling(false)
      setTimeout(() => {
        router.push("/demo/success")
      }, 2000)
    }, 3000)
  }

  const currentTokenData = tokens[selectedChain as keyof typeof tokens]?.find((t) => t.id === selectedToken)

  return (
    <div className="relative flex h-full w-full min-h-[600px]">
      <DialogClose className="absolute right-3 top-3 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground bg-white/80 backdrop-blur-sm p-1">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogClose>

      <div className="grid grid-cols-1 lg:grid-cols-3 w-full">
        {/* Column 1: Blockchain Selection (Left Sidebar) */}
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
                    "w-full justify-start h-9 sm:h-10 text-xs sm:text-sm rounded-md border-gray-200",
                    selectedChain === chain.id && "border-blue-500 ring-2 ring-blue-200 bg-blue-50 text-blue-800",
                  )}
                  onClick={() => setSelectedChain(chain.id)}
                >
                  <Icon className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
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
              >
                {token.name}
              </Badge>
            ))}
          </div>

          {/* QR Code */}
          <div className="bg-white rounded-xl p-3 sm:p-4 border-2 border-dashed border-gray-200 flex justify-center mb-3 sm:mb-4">
            <div className="w-32 h-32 sm:w-40 sm:h-40 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center">
              <QrCode className="w-16 h-16 sm:w-20 sm:h-20 text-gray-400" />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 sm:space-y-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full bg-transparent border-gray-200 h-8 sm:h-9 text-xs sm:text-sm"
              onClick={copyLink}
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <LinkIcon className="w-3 h-3 mr-1" />
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
              <Link href="/demo/payment">
                <ExternalLink className="w-3 h-3 mr-1" />
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
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center text-lg sm:text-xl">
              {invoiceData.merchantLogo}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{invoiceData.merchantName}</h3>
              <p className="text-xs sm:text-sm text-gray-500">Invoice ID: {invoiceData.invoiceId}</p>
            </div>
          </div>

          {/* Amount Details */}
          <div className="bg-gray-50 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex justify-between items-center mb-2 sm:mb-3">
              <span className="text-gray-600 text-sm sm:text-base">Amount Due</span>
              <span className="font-bold text-gray-900">{invoiceData.amountFiat}</span>
            </div>
            {currentTokenData && (
              <div className="flex justify-between items-center text-xs sm:text-sm">
                <span className="text-gray-600">You Pay</span>
                <span className="font-medium text-gray-900">
                  ≈ {currentTokenData.amount} {currentTokenData.name}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center text-xs sm:text-sm mt-2">
              <span className="text-gray-600">Network</span>
              <span className="font-medium text-gray-900">{chains.find((c) => c.id === selectedChain)?.name}</span>
            </div>
            <div className="flex justify-between items-center text-xs sm:text-sm mt-2">
              <span className="text-gray-600">Gas Fees</span>
              <span className="font-medium text-green-600">Sponsored</span>
            </div>
          </div>

          {/* Confirmation Button */}
          <Button
            className="w-full h-9 sm:h-10 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-sm sm:text-base font-semibold"
            onClick={handlePaidClick}
            disabled={isPolling || isPaid}
          >
            {isPolling ? (
              <>
                <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-2 animate-spin" />
                Waiting for Payment... 
              </>
            ) : isPaid ? (
              <>
                <Check className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
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
                <Check className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 mr-2" />
                <div>
                  <p className="font-medium text-green-900 text-xs sm:text-sm">Payment Confirmed</p>
                  <p className="text-xs text-green-700">Transaction verified on blockchain. Redirecting...</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
