"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Check,
  Zap,
  Building2,
  Crown,
  Globe,
  ArrowRight,
  Calculator,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import Link from "next/link";
import PrismBackground from "@/components/prism-background";
import { SignupModal } from "@/components/signup-modal";
import Image from "next/image";

export default function PricingPage() {
  const [monthlyVolume, setMonthlyVolume] = useState([10000]);
  const [isAnnual, setIsAnnual] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);

  const handleGetStarted = () => {
    setShowSignupModal(true);
  };

  const calculateFees = (volume: number) => {
    const transactionFee = volume * 0.005; // 0.5%
    const settlementFee = volume * 0.001; // 0.1% for volatile assets
    return {
      transactionFee,
      settlementFee,
      total: transactionFee + settlementFee,
    };
  };

  const fees = calculateFees(monthlyVolume[0]);

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
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Background Animation */}
      <div
        style={{
          width: "100%",
          height: "100vh",
          position: "fixed",
          top: 0,
          left: 0,
          pointerEvents: "none",
        }}
      >
        <PrismBackground
          animationType="3drotate"
          timeScale={0.5}
          height={3.5}
          baseWidth={4.5}
          scale={3.6}
          hueShift={0.125}
          colorFrequency={0.8}
          noise={0.2}
          glow={0.5}
        />
      </div>

      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Link>
            </Button>
            {/* <div className="flex-shrink-0">
              <Link href="/" className="flex items-center">
                <Image
                  src="/egyptfi_logo-03.png"
                  alt="EGYPTFI"
                  width={840}
                  height={280}
                  className="h-8 w-auto dark:hidden"
                />
                <Image
                  src="/egyptfi_white-03.png"
                  alt="EGYPTFI"
                  width={840}
                  height={280}
                  className="h-8 w-auto hidden dark:block"
                />
              </Link>
            </div> */}
          </div>
          <div className="flex items-center space-x-4">
            <Button
              onClick={handleGetStarted}
              className="bg-[#d4af37] hover:bg-[#d4af37]/90 text-white"
            >
              Get Started
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-7xl">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-[#d4af37] rounded-full text-sm font-medium mb-6">
            <Calculator className="w-4 h-4 mr-2" />
            Transparent Pricing
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Simple, Transparent <span className="text-[#d4af37]">Pricing</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Pay only for what you use. No hidden fees, no setup costs. Start
            free and scale as you grow.
          </p>
        </div>

        {/* Pricing Calculator */}
        <Card className="mb-16 shadow-lg border-0">
          <CardHeader>
            <CardTitle className="text-center text-foreground">
              Pricing Calculator
            </CardTitle>
            {/* <p className="text-center text-muted-foreground">See how much you'll pay based on your monthly volume</p> */}
          </CardHeader>
          <CardContent>
            <div className="max-w-2xl mx-auto">
              <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-medium text-muted-foreground">
                    Monthly Volume
                  </span>
                  <span className="text-lg font-bold text-foreground">
                    ${monthlyVolume[0].toLocaleString()}
                  </span>
                </div>
                <Slider
                  value={monthlyVolume}
                  onValueChange={setMonthlyVolume}
                  max={100000}
                  min={1000}
                  step={1000}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>$1K</span>
                  <span>$50K</span>
                  <span>$100K+</span>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-blue-600 mb-1">
                    Transaction Fees (0.5%)
                  </p>
                  <p className="text-2xl font-bold text-blue-900">
                    ${fees.transactionFee.toFixed(0)}
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-green-600 mb-1">
                    Settlement Fees (0.1%)
                  </p>
                  <p className="text-2xl font-bold text-green-900">
                    ${fees.settlementFee.toFixed(0)}
                  </p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-purple-600 mb-1">
                    Total Monthly Cost
                  </p>
                  <p className="text-2xl font-bold text-purple-900">
                    ${fees.total.toFixed(0)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Enterprise Section */}
        <Card className="mb-16 shadow-lg border-0 bg-card">
          <CardContent className="p-12">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center mb-6">
                  <Globe className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl font-bold mb-4 text-card-foreground">
                  Enterprise Solutions
                </h2>
                <p className="text-muted-foreground mb-6 text-lg">
                  Custom solutions for large-scale businesses with high
                  transaction volumes and specific requirements.
                </p>
                <div className="space-y-3 mb-8">
                  <div className="flex items-center">
                    <Check className="w-5 h-5 text-green-500 mr-3" />
                    <span className="text-card-foreground">
                      Volume-based pricing (as low as 0.1%)
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Check className="w-5 h-5 text-green-500 mr-3" />
                    <span className="text-card-foreground">
                      White-label licensing available
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Check className="w-5 h-5 text-green-500 mr-3" />
                    <span className="text-card-foreground">
                      Custom settlement terms
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Check className="w-5 h-5 text-green-500 mr-3" />
                    <span className="text-card-foreground">
                      Dedicated support team
                    </span>
                  </div>
                </div>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Contact Sales
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
              <div className="bg-muted rounded-xl p-6">
                <h3 className="font-semibold mb-4 text-muted-foreground">
                  Enterprise Features
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {enterpriseFeatures.map((feature, index) => (
                    <div key={index} className="flex items-center text-sm">
                      <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-muted-foreground">{feature}</span>
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
            <CardTitle className="text-center text-2xl text-foreground">
              How EgyptFi Makes Money
            </CardTitle>
            <p className="text-center text-muted-foreground">
              Transparent revenue model with no hidden fees
            </p>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="transaction-fees" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="transaction-fees">
                  Transaction Fees
                </TabsTrigger>
                <TabsTrigger value="settlement-fees">
                  Settlement Fees
                </TabsTrigger>
                <TabsTrigger value="custom-plans">Custom Plans</TabsTrigger>
                <TabsTrigger value="white-label">White-label</TabsTrigger>
                <TabsTrigger value="fiat-offramp">Fiat Off-ramp</TabsTrigger>
              </TabsList>

              <TabsContent value="transaction-fees" className="mt-6">
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-xl font-semibold mb-4 text-foreground">
                      Transaction Fees
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      We charge a small percentage on each successful payment
                      processed through our platform.
                    </p>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                        <span className="text-foreground">Starter Plan</span>
                        <Badge className="bg-primary text-primary-foreground">
                          0.5%
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                        <span className="text-foreground">Growth Plan</span>
                        <Badge className="bg-primary text-primary-foreground">
                          0.4%
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                        <span className="text-foreground">Scale Plan</span>
                        <Badge className="bg-primary text-primary-foreground">
                          0.3%
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                        <span className="text-foreground">Enterprise</span>
                        <Badge className="bg-secondary text-secondary-foreground">
                          Negotiable
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="bg-card border rounded-xl p-6">
                    <h4 className="font-semibold text-card-foreground mb-3">
                      What's Included
                    </h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2 text-green-500" />
                        Multi-chain payment processing
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2 text-green-500" />
                        Real-time conversion rates
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2 text-green-500" />
                        Gas fee sponsorship
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2 text-green-500" />
                        Payment verification
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2 text-green-500" />
                        Fraud protection
                      </li>
                    </ul>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="settlement-fees" className="mt-6">
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-xl font-semibold mb-4 text-foreground">
                      Settlement Fees
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Optional fees when converting volatile crypto assets to
                      stablecoins for settlement.
                    </p>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                        <span className="text-foreground">
                          Stablecoin Payments (USDC, DAI)
                        </span>
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                          Free
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                        <span className="text-foreground">
                          Volatile Assets (ETH, BTC)
                        </span>
                        <Badge className="bg-primary text-primary-foreground">
                          0.1%
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="bg-card border rounded-xl p-6">
                    <h4 className="font-semibold text-card-foreground mb-3">
                      Settlement Benefits
                    </h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2 text-green-500" />
                        Instant USDC settlement
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2 text-green-500" />
                        Price protection from volatility
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2 text-green-500" />
                        Automated conversion
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2 text-green-500" />
                        StarkNet settlement
                      </li>
                    </ul>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="custom-plans" className="mt-6">
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-xl font-semibold mb-4 text-foreground">
                      Custom Plan Pricing
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      High-volume merchants get custom pricing.
                    </p>
                    <div className="space-y-4">
                      <div className="border rounded-lg p-4 bg-card">
                        <h4 className="font-semibold mb-2 text-card-foreground">
                          Volume Tiers
                        </h4>
                        <div className="space-y-2 text-sm text-muted-foreground">
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
                  <div className="bg-card border rounded-xl p-6">
                    <h4 className="font-semibold text-card-foreground mb-3">
                      Custom Plan Features
                    </h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2 text-green-500" />
                        Volume-based pricing
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2 text-green-500" />
                        Dedicated account manager
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2 text-green-500" />
                        Custom integration support
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2 text-green-500" />
                        Priority support
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2 text-green-500" />
                        Custom SLA agreements
                      </li>
                    </ul>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="white-label" className="mt-6">
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-xl font-semibold mb-4 text-foreground">
                      White-label Licensing
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Enterprise clients can license our technology to offer
                      crypto payments under their own brand.
                    </p>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                        <span className="text-foreground">Setup Fee</span>
                        <Badge className="bg-primary text-primary-foreground">
                          $50,000
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                        <span className="text-foreground">Monthly License</span>
                        <Badge className="bg-primary text-primary-foreground">
                          $5,000/month
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                        <span className="text-foreground">Revenue Share</span>
                        <Badge className="bg-secondary text-secondary-foreground">
                          10% of transaction fees
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="bg-card border rounded-xl p-6">
                    <h4 className="font-semibold text-card-foreground mb-3">
                      White-label Benefits
                    </h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2 text-green-500" />
                        Full brand customization
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2 text-green-500" />
                        Complete API access
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2 text-green-500" />
                        Multi-tenant architecture
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2 text-green-500" />
                        Custom domain support
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2 text-green-500" />
                        Revenue sharing model
                      </li>
                    </ul>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="fiat-offramp" className="mt-6">
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-xl font-semibold mb-4 text-foreground">
                      Fiat Off-ramp Integration
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Future feature allowing merchants to convert crypto
                      directly to local bank accounts.
                    </p>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                        <span className="text-foreground">Conversion Fee</span>
                        <Badge className="bg-primary text-primary-foreground">
                          0.5%
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                        <span className="text-foreground">
                          Bank Transfer Fee
                        </span>
                        <Badge className="bg-primary text-primary-foreground">
                          $2 per transfer
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                        <span className="text-foreground">Settlement Time</span>
                        <Badge className="bg-secondary text-secondary-foreground">
                          1-3 business days
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="bg-card border rounded-xl p-6">
                    <h4 className="font-semibold text-card-foreground mb-3">
                      Coming Soon
                    </h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2 text-green-500" />
                        Direct bank settlements
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2 text-green-500" />
                        Multiple currency support
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2 text-green-500" />
                        Compliance integration
                      </li>
                      <li className="flex items-center">
                        <Check className="w-4 h-4 mr-2 text-green-500" />
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
        <Card className="shadow-lg border-0 bg-card">
          <CardHeader>
            <CardTitle className="text-center text-2xl text-card-foreground">
              Frequently Asked Questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-2 text-card-foreground">
                    Are there any setup fees?
                  </h4>
                  <p className="text-muted-foreground text-sm">
                    No setup fees for standard plans. Enterprise and white-label
                    solutions may have setup costs.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2 text-card-foreground">
                    When are fees charged?
                  </h4>
                  <p className="text-muted-foreground text-sm">
                    Fees are only charged on successful payments. Failed or
                    cancelled payments incur no fees.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2 text-card-foreground">
                    Can I change plans anytime?
                  </h4>
                  <p className="text-muted-foreground text-sm">
                    Yes, you can upgrade or downgrade your plan at any time.
                    Changes take effect immediately.
                  </p>
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-2 text-card-foreground">
                    Do you offer volume discounts?
                  </h4>
                  <p className="text-muted-foreground text-sm">
                    Yes, we offer custom pricing for high-volume merchants.
                    Contact our sales team for details.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2 text-card-foreground">
                    What about gas fees?
                  </h4>
                  <p className="text-muted-foreground text-sm">
                    We sponsor gas fees for your customers. This cost is
                    included in our transaction fees.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2 text-card-foreground">
                    Is there a free trial?
                  </h4>
                  <p className="text-muted-foreground text-sm">
                    Yes, our Starter plan is free up to $5,000 monthly volume
                    with 100 transactions.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Signup Modal */}
      <SignupModal
        isOpen={showSignupModal}
        onClose={() => setShowSignupModal(false)}
      />
    </div>
  );
}
