"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Wallet, Check, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function PaymentPage() {
  const [selectedChain, setSelectedChain] = useState("")
  const [selectedToken, setSelectedToken] = useState("")
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isPaying, setIsPaying] = useState(false)
  const [conversionRate, setConversionRate] = useState("3.2")
  const router = useRouter()

  const chains = [
    { id: "ethereum", name: "Ethereum", icon: "⟠" },
    { id: "starknet", name: "StarkNet", icon: "⬟" },
    { id: "polygon", name: "Polygon", icon: "⬢" },
  ]

  const tokens = {
    ethereum: [
      { id: "usdc", name: "USDC", amount: "3.2", icon: "💵" },
      { id: "eth", name: "ETH", amount: "0.0013", icon: "⟠" },
      { id: "dai", name: "DAI", amount: "3.18", icon: "◈" },
    ],
    starknet: [
      { id: "usdc", name: "USDC", amount: "3.2", icon: "💵" },
      { id: "eth", name: "ETH", amount: "0.0013", icon: "⟠" },
    ],
    polygon: [
      { id: "usdc", name: "USDC", amount: "3.2", icon: "💵" },
      { id: "matic", name: "MATIC", amount: "4.1", icon: "⬢" },
      { id: "dai", name: "DAI", amount: "3.18", icon: "◈" },
    ],
  }

  const connectWallet = async () => {
    setIsConnecting(true)
    // Simulate wallet connection
    setTimeout(() => {
      setIsConnected(true)
      setIsConnecting(false)
    }, 2000)
  }

  const handlePayment = async () => {
    setIsPaying(true)
    // Simulate payment processing
    setTimeout(() => {
      router.push("/demo/success")
    }, 3000)
  }

  // Simulate real-time rate updates
  useEffect(() => {
    const interval = setInterval(() => {
      const variation = (Math.random() - 0.5) * 0.1
      setConversionRate((prev) => (Number.parseFloat(prev) + variation).toFixed(2))
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const selectedTokenData =
    selectedChain && selectedToken
      ? tokens[selectedChain as keyof typeof tokens]?.find((t) => t.id === selectedToken)
      : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4">
      <div className="container mx-auto max-w-2xl">
        {/* Header */}
        <div className="flex items-center mb-8">
          <Button variant="ghost" size="sm" asChild className="mr-4">
            <Link href="/demo/invoice">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Invoice
            </Link>
          </Button>
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            Demo Payment
          </Badge>
        </div>

        {/* Payment Card */}
        <Card className="shadow-2xl border-0">
          <CardContent className="p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center text-2xl mx-auto mb-4">
                ☕
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Complete Payment</h1>
              <p className="text-gray-500">TheBuidl Kitchen, Kaduna • ₦5,000</p>
            </div>

            {/* Wallet Connection */}
            {!isConnected ? (
              <div className="text-center mb-8">
                <div className="bg-gray-50 rounded-xl p-8 mb-6">
                  <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Connect Your Wallet</h3>
                  <p className="text-gray-500 mb-6">Connect your crypto wallet to complete the payment</p>
                  <Button
                    onClick={connectWallet}
                    disabled={isConnecting}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Wallet className="w-4 h-4 mr-2" />
                        Connect Wallet
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Connected Wallet */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center">
                    <Check className="w-5 h-5 text-green-600 mr-2" />
                    <div>
                      <p className="font-medium text-green-900">Wallet Connected</p>
                      <p className="text-sm text-green-700">0x1234...5678</p>
                    </div>
                  </div>
                </div>

                {/* Chain Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Network</label>
                  <Select value={selectedChain} onValueChange={setSelectedChain}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a blockchain network" />
                    </SelectTrigger>
                    <SelectContent>
                      {chains.map((chain) => (
                        <SelectItem key={chain.id} value={chain.id}>
                          <div className="flex items-center">
                            <span className="mr-2">{chain.icon}</span>
                            {chain.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Token Selection */}
                {selectedChain && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Token</label>
                    <Select value={selectedToken} onValueChange={setSelectedToken}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose a token to pay with" />
                      </SelectTrigger>
                      <SelectContent>
                        {tokens[selectedChain as keyof typeof tokens]?.map((token) => (
                          <SelectItem key={token.id} value={token.id}>
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center">
                                <span className="mr-2">{token.icon}</span>
                                {token.name}
                              </div>
                              <span className="text-gray-500">{token.amount}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Payment Summary */}
                {selectedTokenData && (
                  <div className="bg-gray-50 rounded-xl p-6 mb-6">
                    <h3 className="font-semibold text-gray-900 mb-4">Payment Summary</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Amount (NGN)</span>
                        <span className="font-medium">₦5,000</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">You Pay</span>
                        <span className="font-medium">
                          {selectedTokenData.amount} {selectedTokenData.name}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Network</span>
                        <span className="font-medium">{chains.find((c) => c.id === selectedChain)?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Gas Fees</span>
                        <span className="font-medium text-green-600">Free</span>
                      </div>
                      <div className="border-t pt-3 flex justify-between">
                        <span className="font-semibold">Total</span>
                        <span className="font-semibold">
                          {selectedTokenData.amount} {selectedTokenData.name}
                        </span>
                      </div>
                    </div>

                    {/* Live Rate Update */}
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center text-sm">
                        <AlertCircle className="w-4 h-4 text-blue-600 mr-2" />
                        <span className="text-blue-800">
                          Live rate: 1 USDC = ₦{(5000 / Number.parseFloat(conversionRate)).toFixed(0)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pay Button */}
                <Button
                  onClick={handlePayment}
                  disabled={!selectedChain || !selectedToken || isPaying}
                  className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 py-3"
                >
                  {isPaying ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing Payment...
                    </>
                  ) : (
                    <>
                      <Wallet className="w-4 h-4 mr-2" />
                      Pay {selectedTokenData ? `${selectedTokenData.amount} ${selectedTokenData.name}` : ""}
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            Powered by{" "}
            <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium">
              Nummus
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
