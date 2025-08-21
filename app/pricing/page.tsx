"use client"

import { useState } from "react"
import { ArrowLeft, Check, Zap, Building2, Crown, Globe, ArrowRight, Calculator } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import Link from "next/link"

export default function PricingPage() {
  const [monthlyVolume, setMonthlyVolume] = useState([10000])
  const [isAnnual, setIsAnnual] = useState(false)

  const calculateFees = (volume: number) => {
    const transactionFee = volume * 0.005 // 0.5%
    const settlementFee = volume * 0.001 // 0.1% for volatile assets
    return { transactionFee, settlementFee, total: transactionFee + settlementFee }
  }

  const fees = calculateFees(monthlyVolume[0])

  const plans = [
    {
      name: "Starter",
      description: "Perfect for small businesses and startups",
      price: "Free",
      monthlyPrice: 0,
      annualPrice: 0,
      features: [
        "Up to $5,000 monthly volume",
        "0.5% transaction fee",
        "Basic payment links",
        "Email support",
        "Standard settlement (24h)",
        "Basic analytics",
      ],
      limitations: ["Limited to 100 transactions/month", "Standard support only"],
      cta: "Get Started Free",
      popular: false,
    },
    {
      name: "Growth",
      description: "For growing businesses with higher volume",
      price: isAnnual ? "$29/mo" : "$39/mo",
      monthlyPrice: 39,
      annualPrice: 29,
      features: [
        "Up to $50,000 monthly volume",
        "0.4% transaction fee",
        "Custom payment pages",
        "Priority email support",
        "Instant settlement",
        "Advanced analytics",
        "Webhook notifications",
        "API access",
      ],
      limitations: [],
      cta: "Start Growth Plan",
      popular: true,
    },
    {
      name: "Scale",
      description: "For established businesses with high volume",
      price: isAnnual ? "$99/mo" : "$129/mo",
      monthlyPrice: 129,
      annualPrice: 99,
      features: [
        "Up to $500,000 monthly volume",
        "0.3% transaction fee",
        "White-label payment pages",
        "Phone & email support",
        "Instant settlement",
        "Real-time analytics",
        "Advanced webhooks",
        "Full API access",
        "Custom integrations",
        "Dedicated account manager",
      ],
      limitations: [],
      cta: "Start Scale Plan",
      popular: false,
    },
  ]

  const enterpriseFeatures = [
    "Custom transaction fees (negotiable)",
    "White-label licensing",
    "Custom settlement terms",
    "Dedicated infrastructure",
    "24/7 phone support",
    "Custom SLA agreements",
    "Advanced compliance tools",
    "Multi-tenant architecture",
    "Custom reporting",
    "Priority feature requests",
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Link>
            </Button>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">N</span>
              </div>
              <span className="text-xl font-bold text-gray-900">EgyptFi</span>
            </div>
          </div>
          <Button
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            asChild
          >
            <Link href="/signup">Get Started</Link>
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-7xl">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-6">
            <Calculator className="w-4 h-4 mr-2" />
            Transparent Pricing
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Simple, Transparent{" "}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Pricing</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Pay only for what you use. No hidden fees, no setup costs. Start free and scale as you grow.
          </p>

          {/* Annual/Monthly Toggle */}
          <div className="flex items-center justify-center space-x-4 mb-8">
            <span className={`text-sm ${!isAnnual ? "text-gray-900 font-medium" : "text-gray-500"}`}>Monthly</span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isAnnual ? "bg-blue-600" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isAnnual ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span className={`text-sm ${isAnnual ? "text-gray-900 font-medium" : "text-gray-500"}`}>
              Annual
              <Badge className="ml-2 bg-green-100 text-green-800">Save 25%</Badge>
            </span>
          </div>
        </div>

        {/* Pricing Calculator */}
        <Card className="mb-16 shadow-lg border-0">
          <CardHeader>
            <CardTitle className="text-center">Pricing Calculator</CardTitle>
            <p className="text-center text-gray-600">See how much you'll pay based on your monthly volume</p>
          </CardHeader>
          <CardContent>
            <div className="max-w-2xl mx-auto">
              <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-medium text-gray-700">Monthly Volume</span>
                  <span className="text-lg font-bold text-gray-900">${monthlyVolume[0].toLocaleString()}</span>
                </div>
                <Slider
                  value={monthlyVolume}
                  onValueChange={setMonthlyVolume}
                  max={100000}
                  min={1000}
                  step={1000}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>$1K</span>
                  <span>$50K</span>
                  <span>$100K+</span>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-blue-600 mb-1">Transaction Fees (0.5%)</p>
                  <p className="text-2xl font-bold text-blue-900">${fees.transactionFee.toFixed(0)}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-green-600 mb-1">Settlement Fees (0.1%)</p>
                  <p className="text-2xl font-bold text-green-900">${fees.settlementFee.toFixed(0)}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-purple-600 mb-1">Total Monthly Cost</p>
                  <p className="text-2xl font-bold text-purple-900">${fees.total.toFixed(0)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing Plans */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan, index) => (
            <Card
              key={index}
              className={`relative shadow-lg border-0 ${
                plan.popular ? "ring-2 ring-blue-500 transform scale-105" : ""
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-blue-600 text-white px-4 py-1">Most Popular</Badge>
                </div>
              )}
              <CardHeader className="text-center pb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                  {index === 0 && <Zap className="w-6 h-6 text-white" />}
                  {index === 1 && <Building2 className="w-6 h-6 text-white" />}
                  {index === 2 && <Crown className="w-6 h-6 text-white" />}
                </div>
                <CardTitle className="text-xl font-bold text-gray-900">{plan.name}</CardTitle>
                <p className="text-gray-600 text-sm">{plan.description}</p>
                <div className="mt-4">
                  <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                  {plan.monthlyPrice > 0 && <span className="text-gray-500 text-sm">/month</span>}
                </div>
                {isAnnual && plan.monthlyPrice > 0 && (
                  <p className="text-sm text-green-600">Save ${(plan.monthlyPrice - plan.annualPrice) * 12}/year</p>
                )}
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start">
                      <Check className="w-4 h-4 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                {plan.limitations.length > 0 && (
                  <div className="mb-6">
                    <p className="text-xs text-gray-500 mb-2">Limitations:</p>
                    <ul className="space-y-1">
                      {plan.limitations.map((limitation, limitIndex) => (
                        <li key={limitIndex} className="text-xs text-gray-500">
                          • {limitation}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <Button
                  className={`w-full ${
                    plan.popular
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                      : "bg-gray-900 hover:bg-gray-800"
                  }`}
                  asChild
                >
                  <Link href="/signup">{plan.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Enterprise Section */}
        <Card className="mb-16 shadow-lg border-0 bg-gradient-to-r from-gray-900 to-gray-800 text-white">
          <CardContent className="p-12">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center mb-6">
                  <Globe className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl font-bold mb-4">Enterprise Solutions</h2>
                <p className="text-gray-300 mb-6 text-lg">
                  Custom solutions for large-scale businesses with high transaction volumes and specific requirements.
                </p>
                <div className="space-y-3 mb-8">
                  <div className="flex items-center">
                    <Check className="w-5 h-5 text-green-400 mr-3" />
                    <span>Volume-based pricing (as low as 0.1%)</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="w-5 h-5 text-green-400 mr-3" />
                    <span>White-label licensing available</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="w-5 h-5 text-green-400 mr-3" />
                    <span>Custom settlement terms</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="w-5 h-5 text-green-400 mr-3" />
                    <span>Dedicated support team</span>
                  </div>
                </div>
                <Button className="bg-white text-gray-900 hover:bg-gray-100">
                  Contact Sales
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
              <div className="bg-white/10 rounded-xl p-6">
                <h3 className="font-semibold mb-4">Enterprise Features</h3>
                <div className="grid grid-cols-1 gap-2">
                  {enterpriseFeatures.map((feature, index) => (
                    <div key={index} className="flex items-center text-sm">
                      <Check className="w-4 h-4 text-green-400 mr-2 flex-shrink-0" />
                      <span className="text-gray-300">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* How We Make Money */}
        <Card className="mb-16 shadow-lg border-0">
          <CardHeader>
            <CardTitle className="text-center text-2xl">How EgyptFi Makes Money</CardTitle>
            <p className="text-center text-gray-600">Transparent revenue model with no hidden fees</p>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="transaction-fees" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="transaction-fees">Transaction Fees</TabsTrigger>
                <TabsTrigger value="settlement-fees">Settlement Fees</TabsTrigger>
                <TabsTrigger value="custom-plans">Custom Plans</TabsTrigger>
                <TabsTrigger value="white-label">White-label</TabsTrigger>
                <TabsTrigger value="fiat-offramp">Fiat Off-ramp</TabsTrigger>
              </TabsList>

              <TabsContent value="transaction-fees" className="mt-6">
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-xl font-semibold mb-4">Transaction Fees</h3>
                    <p className="text-gray-600 mb-4">
                      We charge a small percentage on each successful payment processed through our platform.
                    </p>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span>Starter Plan</span>
                        <Badge>0.5%</Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span>Growth Plan</span>
                        <Badge>0.4%</Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span>Scale Plan</span>
                        <Badge>0.3%</Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span>Enterprise</span>
                        <Badge>Negotiable</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-6">
                    <h4 className="font-semibold text-blue-900 mb-3">What's Included</h4>
                    <ul className="space-y-2 text-sm text-blue-800">
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2" />
                        Multi-chain payment processing
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2" />
                        Real-time conversion rates
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2" />
                        Gas fee sponsorship
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2" />
                        Payment verification
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2" />
                        Fraud protection
                      </li>
                    </ul>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="settlement-fees" className="mt-6">
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-xl font-semibold mb-4">Settlement Fees</h3>
                    <p className="text-gray-600 mb-4">
                      Optional fees when converting volatile crypto assets to stablecoins for settlement.
                    </p>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span>Stablecoin Payments (USDC, DAI)</span>
                        <Badge className="bg-green-100 text-green-800">Free</Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span>Volatile Assets (ETH, BTC)</span>
                        <Badge>0.1%</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="bg-green-50 rounded-xl p-6">
                    <h4 className="font-semibold text-green-900 mb-3">Settlement Benefits</h4>
                    <ul className="space-y-2 text-sm text-green-800">
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2" />
                        Instant USDC settlement
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2" />
                        Price protection from volatility
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2" />
                        Automated conversion
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2" />
                        StarkNet settlement
                      </li>
                    </ul>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="custom-plans" className="mt-6">
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-xl font-semibold mb-4">Custom Plan Pricing</h3>
                    <p className="text-gray-600 mb-4">
                      High-volume merchants get custom pricing similar to Paystack's enterprise model.
                    </p>
                    <div className="space-y-4">
                      <div className="border rounded-lg p-4">
                        <h4 className="font-semibold mb-2">Volume Tiers</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>$0 - $100K/month</span>
                            <span>Standard rates</span>
                          </div>
                          <div className="flex justify-between">
                            <span>$100K - $1M/month</span>
                            <span>0.25% transaction fee</span>
                          </div>
                          <div className="flex justify-between">
                            <span>$1M+/month</span>
                            <span>Custom negotiated rates</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-6">
                    <h4 className="font-semibold text-purple-900 mb-3">Custom Plan Features</h4>
                    <ul className="space-y-2 text-sm text-purple-800">
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2" />
                        Volume-based pricing
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2" />
                        Dedicated account manager
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2" />
                        Custom integration support
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2" />
                        Priority support
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2" />
                        Custom SLA agreements
                      </li>
                    </ul>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="white-label" className="mt-6">
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-xl font-semibold mb-4">White-label Licensing</h3>
                    <p className="text-gray-600 mb-4">
                      Enterprise clients can license our technology to offer crypto payments under their own brand.
                    </p>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span>Setup Fee</span>
                        <Badge>$50,000</Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span>Monthly License</span>
                        <Badge>$5,000/month</Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span>Revenue Share</span>
                        <Badge>10% of transaction fees</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="bg-yellow-50 rounded-xl p-6">
                    <h4 className="font-semibold text-yellow-900 mb-3">White-label Benefits</h4>
                    <ul className="space-y-2 text-sm text-yellow-800">
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2" />
                        Full brand customization
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2" />
                        Complete API access
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2" />
                        Multi-tenant architecture
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2" />
                        Custom domain support
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2" />
                        Revenue sharing model
                      </li>
                    </ul>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="fiat-offramp" className="mt-6">
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-xl font-semibold mb-4">Fiat Off-ramp Integration</h3>
                    <p className="text-gray-600 mb-4">
                      Future feature allowing merchants to convert crypto directly to local bank accounts.
                    </p>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span>Conversion Fee</span>
                        <Badge>0.5%</Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span>Bank Transfer Fee</span>
                        <Badge>$2 per transfer</Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <span>Settlement Time</span>
                        <Badge>1-3 business days</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="bg-orange-50 rounded-xl p-6">
                    <h4 className="font-semibold text-orange-900 mb-3">Coming Soon</h4>
                    <ul className="space-y-2 text-sm text-orange-800">
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2" />
                        Direct bank settlements
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2" />
                        Multiple currency support
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2" />
                        Compliance integration
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2" />
                        Tax reporting tools
                      </li>
                    </ul>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="text-center text-2xl">Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-2">Are there any setup fees?</h4>
                  <p className="text-gray-600 text-sm">
                    No setup fees for standard plans. Enterprise and white-label solutions may have setup costs.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">When are fees charged?</h4>
                  <p className="text-gray-600 text-sm">
                    Fees are only charged on successful payments. Failed or cancelled payments incur no fees.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Can I change plans anytime?</h4>
                  <p className="text-gray-600 text-sm">
                    Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.
                  </p>
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-2">Do you offer volume discounts?</h4>
                  <p className="text-gray-600 text-sm">
                    Yes, we offer custom pricing for high-volume merchants. Contact our sales team for details.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">What about gas fees?</h4>
                  <p className="text-gray-600 text-sm">
                    We sponsor gas fees for your customers. This cost is included in our transaction fees.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Is there a free trial?</h4>
                  <p className="text-gray-600 text-sm">
                    Yes, our Starter plan is free up to $5,000 monthly volume with 100 transactions.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
