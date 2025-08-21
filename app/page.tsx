"use client"

import {
  ArrowRight,
  Check,
  Zap,
  Shield,
  RefreshCw,
  DollarSign,
  Wallet,
  Code,
  Building2,
  Users,
  Twitter,
  Send,
  AlertCircle,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { YieldWaitlist } from "@/components/yield-waitlist"
import { ShoppingCart } from "@/components/shopping-cart"
import { useEffect, useState } from 'react';

const taglines = [
  "Seamless Crypto Transactions",
  "Easy to Integrate APIs",
  "Accept Crypto with Zero Friction",
  "Refundable. Gas-free. Developer-friendly",
];

export default function HomePage() {
   const [isInitiating, setIsInitiating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)

   const [currentIndex, setCurrentIndex] = useState(0);
  const [fade, setFade] = useState(true);
 

   useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);

      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % taglines.length);
        setFade(true);
      }, 300); // wait for fade-out before switching
    }, 4000); // change every 4s

    return () => clearInterval(interval);
  }, []);

   const cartItems = [
    { name: "Rice", description: "Jollof RIce", icon: "☕", price: "₦8,500", quantity: 1 },
    { name: "Chicken", description: "Large laps", icon: "🥐", price: "₦1,500", quantity: 1 },
    { name: "Drink", description: "Cocacola", icon: "🧊", price: "₦1,000", quantity: 1 },
  ]

  const handleCheckout = async () => {
    setIsInitiating(true)
    setError(null)
    setQrCode(null)

    try {
      const response = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: {
          'X-API-Key': 'pk_test_e20af044678ed83d9d1b151f93403e90', // Mock API key for demo
          'X-Wallet-Address': '0x065982b15Bc87AbdAa2DA7DB5F2164792b6c2e497bd80f4b7ace9E799Be4Beb0', // Mock wallet address
          'X-Environment': 'testnet',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment_ref: `order-${Date.now()}`,
          local_amount: 11000,
          local_currency: "NGN",
          description: "TheBuidl Kitchen, Kaduna",
          chain: "starknet",
          secondary_endpoint: "http://localhost:3000/confirm",
          email: "emixxshow17@gmail.com",
          // metadata: [{
          //   "cancel_action": "http://localhost:3000"
          // }]
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to initiate payment')
      }      

      const { reference, authorization_url, qr_code } = await response.json()
      
      // Store QR code for display (optional)
      setQrCode(qr_code)
      
      // Redirect to hosted payment page
      window.location.href = authorization_url
    } catch (err) {
      console.error('Payment initiation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to initiate payment')
    } finally {
      setIsInitiating(false)
    }
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">eFi</span>
            </div>
            <span className="text-xl font-bold text-gray-900">EgyptFi</span>
          </div>
          <nav className="hidden md:flex items-center space-x-8">
            <Link href="/docs" className="text-gray-600 hover:text-gray-900 transition-colors">
              Docs
            </Link>
            <Link href="/pricing" className="text-gray-600 hover:text-gray-900 transition-colors">
              Pricing
            </Link>
            <Link href="/blog" className="text-gray-600 hover:text-gray-900 transition-colors">
              Blog
            </Link>
            <Link href="/contact" className="text-gray-600 hover:text-gray-900 transition-colors">
              Contact
            </Link>
          </nav>
          <div className="flex items-center space-x-3">
            <Button variant="outline" className="bg-transparent" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              asChild
            >
              <Link href="/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
           <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-8">
            <Zap className="w-4 h-4 mr-2" />
            Crypto payments without the complexity.
          </div>

          {/* <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Accept Crypto Instantly —{" "}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              QR, Wallet, API
            </span>
          </h1> */}

          <h1
            className={`bg-gradient-to-r from-blue-600 to-purple-600  bg-clip-text text-transparent text-4xl md:text-5xl font-semibold text-center transition-opacity duration-300 ${
              fade ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {taglines[currentIndex]}
          </h1><br />

         <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Let your users pay in ETH, STRK, or USDC and receive USDC on StarkNet automatically. No gas fees for
            customers, real-time conversion, multi-chain support and refundable transactions.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {/* <Button
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-8 py-3 text-lg"
              asChild
            >
              <Link href="/signup">
                Get Started
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button> */}
            <Button variant="outline" size="lg" className="px-8 py-3 text-lg bg-transparent">
              {/* <Link href="/demo/invoice"> */}
              Launch Demo Below
              {/* <ArrowRight className="ml-2 w-5 h-5" /> */}
              {/* </Link> */}
            </Button>
          </div>

         {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-center max-w-md mx-auto">
              <AlertCircle className="w-4 h-4 text-red-600 mr-2" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* QR Code (Optional Display) */}
          {/* {qrCode && (
            <div className="mt-4 flex justify-center">
              <img src={qrCode} alt="Payment QR Code" className="w-40 h-40 rounded-lg border" />
            </div>
          )} */}

          <div className="mt-8 relative">
            <ShoppingCart
              merchantName="Coffee Shop Lagos"
              merchantLogo="☕"
              items={cartItems}
              subtotal="₦11,000"
              tax="₦0"
              total="₦11,000"
            />
            <Button
              className="w-full max-w-2xl mx-auto mt-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              onClick={handleCheckout}
              disabled={isInitiating}
            >
              {isInitiating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Initiating Payment...
                </>
              ) : (
                <>
                  Checkout with Crypto
                  <ArrowRight className="ml-2 w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
     {/* Features Grid */}
      <section className="py-20 px-4 bg-white">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Why Choose Nummus?</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Built for the future of payments with enterprise-grade security and developer-first approach
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center mb-4">
                  <RefreshCw className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Multi-chain Payment Options</h3>
                <p className="text-gray-600">
                  Accept payments across Ethereum, StarkNet, Polygon, and more. One integration, unlimited
                  possibilities.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-blue-500 rounded-lg flex items-center justify-center mb-4">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Real-time Crypto Conversion with Stablecoin Settlement</h3>
                <p className="text-gray-600">
                  We convert crypto payments into stablecoins instantly — matched precisely to your fiat price at the time of checkout.                 </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Fully Verifiable On-chain</h3>
                <p className="text-gray-600">
                  Every transaction is transparent and verifiable on the blockchain. Trust through transparency.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Refundable Transactions</h3>
                <p className="text-gray-600">
                  Supports secure, trackable refund handling for all transactions — enabling safer crypto payments for merchants and customers.

                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-lg flex items-center justify-center mb-4">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Gasless Payments for Customers</h3>
                <p className="text-gray-600">
                  Your customers pay zero gas fees. We handle all the complexity behind the scenes.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-500 rounded-lg flex items-center justify-center mb-4">
                  <Check className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Developer-First API</h3>
                <p className="text-gray-600">
                  RESTful APIs, webhooks, and SDKs. Integrate in minutes with comprehensive documentation.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Sections */}
      <section className="py-20 px-4 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Code className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">For Developers</h3>
                <p className="text-gray-600 mb-6">
                  Integrate crypto payments with our powerful APIs. Complete with webhooks, SDKs, and sandbox
                  environment.
                </p>
                <Button variant="outline" className="w-full bg-transparent" asChild>
                  <Link href="/docs">
                    API Docs
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Building2 className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">For Businesses</h3>
                <p className="text-gray-600 mb-6">
                  Start accepting crypto payments today. Create payment links, manage invoices, and track settlements.
                </p>
                <Button
                  className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                  asChild
                >
                  <Link href="/signup">
                    Create Payment Link
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">For Everyone</h3>
                <p className="text-gray-600 mb-6">
                  Pay with crypto anywhere. Scan QR codes, connect your wallet, and pay instantly with zero gas fees.
                </p>
                <Button variant="outline" className="w-full bg-transparent">
                  Scan & Pay
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Yield Farming Coming Soon - Landing */}
      <section className="py-20 px-4 bg-white">
        <div className="container mx-auto max-w-6xl">
          <div className="grid gap-10 md:grid-cols-2 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                <Badge className="bg-blue-100 text-blue-800">Coming Soon</Badge>
                Yield Farming
              </div>
              <h2 className="mt-4 text-3xl md:text-4xl font-bold text-gray-900">
                Earn yield on idle USDC — directly from Nummus
              </h2>
              <p className="mt-3 text-gray-600">
                Allocate unused balances to on-chain strategies and earn passive yield without leaving your dashboard.
              </p>
              <ul className="mt-6 grid gap-3 text-gray-700">
                <li>• Estimated APY range: 3% - 8% depending on strategy</li>
                <li>• Flexible access to funds and clear on-chain visibility</li>
                <li>• Withdraw anytime. No lockups for core strategies</li>
              </ul>
            </div>
            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <h3 className="text-xl font-semibold text-gray-900">Get early access</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Join the waitlist to be notified when this feature goes live.
                </p>
                <YieldWaitlist />
                <div className="mt-6 grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Est. APY</p>
                    <p className="font-semibold text-gray-900">Up to 8%</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Lockup</p>
                    <p className="font-semibold text-gray-900">None</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Network</p>
                    <p className="font-semibold text-gray-900">StarkNet</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center space-x-2 mb-6">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">N</span>
                </div>
                <span className="text-xl font-bold">EgyptFi</span>
              </div>
              <p className="text-gray-400 mb-6">
                The future of crypto payments. Accept crypto, get stablecoins, globally.
              </p>
              <div className="flex space-x-4">
                <Link href="#" className="text-gray-400 hover:text-white transition-colors">
                  <Twitter className="w-5 h-5" />
                </Link>
                <Link href="#" className="text-gray-400 hover:text-white transition-colors">
                  <Send className="w-5 h-5" />
                </Link>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <Link href="/docs" className="hover:text-white transition-colors">
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="hover:text-white transition-colors">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/api" className="hover:text-white transition-colors">
                    API Reference
                  </Link>
                </li>
                <li>
                  <Link href="/sandbox" className="hover:text-white transition-colors">
                    Sandbox
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <Link href="/blog" className="hover:text-white transition-colors">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="/about" className="hover:text-white transition-colors">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/careers" className="hover:text-white transition-colors">
                    Careers
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-white transition-colors">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <Link href="/help" className="hover:text-white transition-colors">
                    Help Center
                  </Link>
                </li>
                <li>
                  <Link href="/status" className="hover:text-white transition-colors">
                    Status
                  </Link>
                </li>
                <li>
                  <Link href="/security" className="hover:text-white transition-colors">
                    Security
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-white transition-colors">
                    Privacy
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">© 2024 EgyptFi. All rights reserved.</p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link href="/terms" className="text-gray-400 hover:text-white text-sm transition-colors">
                Terms of Service
              </Link>
              <Link href="/privacy" className="text-gray-400 hover:text-white text-sm transition-colors">
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
