"use client"

import { useState } from "react"
import { Check, Copy, ExternalLink, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

export default function SuccessPage() {
  const [copied, setCopied] = useState(false)

  const paymentData = {
    txHash: "0x1234567890abcdef1234567890abcdef12345678",
    amount: "₦5,000",
    tokenPaid: "3.2 USDC",
    chain: "Ethereum",
    merchantReceived: "3.2 USDC",
    settlementChain: "StarkNet",
    timestamp: new Date().toLocaleString(),
    status: "Confirmed",
  }

  const copyTxHash = async () => {
    await navigator.clipboard.writeText(paymentData.txHash)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-8 px-4">
      <div className="container mx-auto max-w-2xl">
        {/* Header */}
        <div className="flex items-center mb-8">
          <Button variant="ghost" size="sm" asChild className="mr-4">
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Link>
          </Button>
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            Payment Complete
          </Badge>
        </div>

        {/* Success Card */}
        <Card className="shadow-2xl border-0">
          <CardContent className="p-8 text-center">
            {/* Success Icon */}
            <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-white" />
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
            <p className="text-gray-600 mb-8">
              Your crypto payment has been confirmed and the merchant has received USDC.
            </p>

            {/* Payment Details */}
            <div className="bg-gray-50 rounded-xl p-6 mb-8 text-left">
              <h3 className="font-semibold text-gray-900 mb-4">Payment Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount Paid</span>
                  <span className="font-medium">{paymentData.amount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Token Used</span>
                  <span className="font-medium">{paymentData.tokenPaid}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Chain</span>
                  <span className="font-medium">{paymentData.chain}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Merchant Received</span>
                  <span className="font-medium text-green-600">{paymentData.merchantReceived}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Settlement Chain</span>
                  <span className="font-medium">{paymentData.settlementChain}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status</span>
                  <Badge className="bg-green-100 text-green-800">{paymentData.status}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Time</span>
                  <span className="font-medium">{paymentData.timestamp}</span>
                </div>
              </div>
            </div>

            {/* Transaction Hash */}
            <div className="bg-blue-50 rounded-xl p-6 mb-8">
              <h3 className="font-semibold text-gray-900 mb-3">Transaction Hash</h3>
              <div className="flex items-center space-x-2">
                <code className="flex-1 text-sm bg-white px-3 py-2 rounded border font-mono text-gray-700">
                  {paymentData.txHash}
                </code>
                <Button variant="outline" size="sm" onClick={copyTxHash} className="bg-transparent">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
                <Button variant="outline" size="sm" className="bg-transparent">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Key Benefits Highlight */}
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-lg p-4 border">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Check className="w-4 h-4 text-green-600" />
                </div>
                <p className="text-sm font-medium text-gray-900">Zero Gas Fees</p>
                <p className="text-xs text-gray-500">You paid no transaction fees</p>
              </div>
              <div className="bg-white rounded-lg p-4 border">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Check className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-sm font-medium text-gray-900">Instant Settlement</p>
                <p className="text-xs text-gray-500">Merchant received USDC immediately</p>
              </div>
              <div className="bg-white rounded-lg p-4 border">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Check className="w-4 h-4 text-purple-600" />
                </div>
                <p className="text-sm font-medium text-gray-900">Multi-Chain</p>
                <p className="text-xs text-gray-500">Cross-chain payment processed</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button variant="outline" className="flex-1 bg-transparent" asChild>
                <Link href="/demo/invoice">Try Another Payment</Link>
              </Button>
              <Button className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600" asChild>
                <Link href="/">Explore Egyptfi</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">This was a demo payment. No real crypto was transferred.</p>
          <p className="text-sm text-gray-500 mt-2">
            Powered by{" "}
            <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium">
              Egyptfi
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
