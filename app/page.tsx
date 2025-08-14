
'use client';
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { YieldWaitlist } from "@/components/yield-waitlist"

import { useEffect, useState } from 'react';

const taglines = [
  "Seamless Crypto Transactions",
  "Easy to Integrate APIs",
  "Accept Crypto with Zero Frictiion",
  "Refundable. Gas-free. Developer-friendly",
];

export default function HomePage() {

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">N</span>
            </div>
            <span className="text-xl font-bold text-gray-900">Nummus</span>
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
            Seamless Crypto Transactions —{" "}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              QR, Wallet, API
            </span>
          </h1> */}

          <h1
            className={`text-4xl md:text-5xl font-semibold text-center transition-opacity duration-300 ${
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
            <Button
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-8 py-3 text-lg"
              asChild
            >
              <Link href="/signup">
                Get Started
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="px-8 py-3 text-lg bg-transparent" asChild>
              <Link href="/demo/invoice">View Demo</Link>
            </Button>
          </div>

          <div className="mt-16 relative">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl mx-auto border">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-blue-500 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold">☕</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">TheBuidl Kitchen, Kaduna</h3>
                    <p className="text-sm text-gray-500">Your order</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">₦5,000</p>
                  <p className="text-sm text-gray-500">≈ 3.2 USDC</p>
                </div>
              </div>

              {/* Shopping Cart Items */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-sm">☕</div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">Iced Coffee</p>
                      <p className="text-xs text-gray-500">Large • Extra shot</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">₦2,500</p>
                    <p className="text-xs text-gray-500">Qty: 1</p>
                  </div>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center text-sm">🥐</div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">Rice</p>
                      <p className="text-xs text-gray-500">Jollof Rice</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">₦1,500</p>
                    <p className="text-xs text-gray-500">Qty: 1</p>
                  </div>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-sm">🧊</div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">Ice Cream</p>
                      <p className="text-xs text-gray-500">Medium • Vanilla</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">₦1,000</p>
                    <p className="text-xs text-gray-500">Qty: 1</p>
                  </div>
                </div>
              </div>

              {/* Total and Checkout */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">₦5,000</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Tax</span>
                  <span className="font-medium">₦0</span>
                </div>
                <div className="border-t pt-2 flex justify-between items-center">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="font-bold text-gray-900">₦5,000</span>
                </div>
              </div>

              <Button
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                asChild
              >
                <Link href="/demo/invoice">
                  Checkout with Crypto
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

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
                <span className="text-xl font-bold">Nummus</span>
              </div>
              <p className="text-gray-400 mb-6">
                The future of crypto payments. Crypto payments without the complexity.
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
            <p className="text-gray-400 text-sm">© 2024 Nummus. All rights reserved.</p>
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
