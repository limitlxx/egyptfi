"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SignupModal } from "@/components/signup-modal";
import { ShoppingCart } from "@/components/shopping-cart";
import { Loader2, AlertCircle, Zap } from "lucide-react";
import Link from "next/link";
import PrismBackground from "@/components/prism-background";

export default function DemoPage() {
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [isInitiating, setIsInitiating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fade, setFade] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  const taglines = [
    "Accept Crypto Instantly — QR, Wallet, API",
    "Crypto payments without the complexity.",
    "Pay in ETH, STRK, or USDC — Receive USDC",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % taglines.length);
        setFade(true);
      }, 300);
    }, 3000);

    return () => clearInterval(interval);
  }, [taglines.length]);

  const handleGetStarted = () => {
    setShowSignupModal(true);
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const ecommerceCartItems = [
    {
      name: "Rice",
      description: "Jollof Rice",
      icon: "🍚",
      price: "₦3000",
      quantity: 1,
    },
    {
      name: "Drink",
      description: "Coca Cola",
      icon: "🥤",
      price: "₦2500",
      quantity: 1,
    },
    {
      name: "Ice cream",
      description: "Vanilla",
      icon: "🍦",
      price: "₦5000",
      quantity: 1,
    },
  ];

  const gameCartItems = [
    {
      name: "Sword Upgrade",
      description: "Legendary Blade",
      icon: "⚔️",
      price: "₦5000",
      quantity: 1,
    },
  ];

  const handleCheckout = async (cartType: "ecommerce" | "game") => {
    setIsInitiating(true);
    setError(null);

    try {
      const response = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: {
          "X-API-Key": "pk_test_b14927117c0c9a9af5a5172f0569e6dd", // Mock API key for demo
          "X-Wallet-Address":
            "0x5033cd9d8d7ec8b4a2a631e1da60e97b652d06c06476402b32a16986413f10d", // Mock wallet address
          "X-Environment": "testnet",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payment_ref: `order-${Date.now()}`,
          local_amount: cartType === "ecommerce" ? 100 : 1000,
          local_currency: "NGN",
          description:
            cartType === "ecommerce" ? "Ecommerce Purchase" : "Game Purchase",
          chain: "starknet",
          secondary_endpoint: "http://localhost:3000/confirm",
          email: "demo@egyptfi.com",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to initiate payment");
      }

      const { authorization_url } = await response.json();

      // Redirect to hosted payment page
      window.location.href = authorization_url;
    } catch (err) {
      console.error("Payment initiation error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to initiate payment"
      );
    } finally {
      setIsInitiating(false);
    }
  };

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

      {/* Navbar */}
      <Navbar
        onGetStarted={handleGetStarted}
        onScrollToSection={scrollToSection}
      />

      {/* Back to Home Button */}
      <div className="absolute top-20 left-4 z-20">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">← Back to Home</Link>
        </Button>
      </div>

      {/* Main Content */}
      <main className="relative z-10 pt-32 pb-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium mb-8">
              <Zap className="w-4 h-4 mr-2" />
              Crypto payments without the complexity.
            </div>

            <h1
              className={`bg-gradient-to-r from-primary to-yellow-600 bg-clip-text text-transparent text-4xl md:text-5xl font-semibold text-center transition-opacity duration-300 ${
                fade ? "opacity-100" : "opacity-0"
              }`}
            >
              {taglines[currentIndex]}
            </h1>
            <br />

            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Let your users pay in ETH, STRK, or USDC and receive USDC on
              StarkNet automatically. No gas fees for customers, real-time
              conversion, multi-chain support and refundable transactions.
            </p>
          </div>

          <Tabs defaultValue="ecommerce" className="max-w-4xl mx-auto ">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="ecommerce">Ecommerce Demo</TabsTrigger>
              <TabsTrigger value="game">Game Demo</TabsTrigger>
            </TabsList>

            <TabsContent value="ecommerce" className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-4">Ecommerce Checkout</h2>
                <ShoppingCart
                  merchantName="Demo Ecommerce Store"
                  merchantLogo="🛒"
                  items={ecommerceCartItems}
                  subtotal="₦10500"
                  tax="₦0"
                  total="₦10500"
                />
                <Button
                  className="w-full max-w-2xl mx-auto mt-4 bg-primary hover:bg-primary/90"
                  onClick={() => handleCheckout("ecommerce")}
                  disabled={isInitiating}
                >
                  {isInitiating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Initiating Payment...
                    </>
                  ) : (
                    <>Checkout with Crypto</>
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="game" className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-4">Game Purchase</h2>
                <ShoppingCart
                  merchantName="Demo Game Store"
                  merchantLogo="🎮"
                  items={gameCartItems}
                  subtotal="₦5000"
                  tax="₦0"
                  total="₦5000"
                />
                <Button
                  className="w-full max-w-2xl mx-auto mt-4 bg-primary hover:bg-primary/90"
                  onClick={() => handleCheckout("game")}
                  disabled={isInitiating}
                >
                  {isInitiating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Initiating Payment...
                    </>
                  ) : (
                    <>Checkout with Crypto</>
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-center max-w-md mx-auto">
              <AlertCircle className="w-4 h-4 text-red-600 mr-2" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <Footer />

      {/* Signup Modal */}
      <SignupModal
        isOpen={showSignupModal}
        onClose={() => setShowSignupModal(false)}
      />
    </div>
  );
}
