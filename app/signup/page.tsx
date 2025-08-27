"use client"

import { useState } from "react"
import { ArrowLeft, Wallet, Mail, Check, Loader2, Shield, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function SignupPage() {
  const [isConnecting, setIsConnecting] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [step, setStep] = useState<"auth" | "business" | "complete">("auth")
  const [authMethod, setAuthMethod] = useState<"wallet" | "google" | null>(null)
  const router = useRouter()

  const connectWallet = async () => {
    setIsConnecting(true)
    setAuthMethod("wallet")
    // Simulate wallet connection
    setTimeout(() => {
      setIsConnecting(false)
      setStep("business")
    }, 2000)
  }

  const signInWithGoogle = async () => {
    setIsGoogleLoading(true)
    setAuthMethod("google")
    // Simulate Google OAuth
    setTimeout(() => {
      setIsGoogleLoading(false)
      setStep("business")
    }, 1500)
  }

  const completeSignup = async () => {
    // Simulate business info submission
    setTimeout(() => {
      setStep("complete")
      // Redirect to dashboard after showing success
      setTimeout(() => {
        router.push("/dashboard")
      }, 3000)
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
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
                <span className="text-white font-bold text-sm">eFi</span>
              </div>
              <span className="text-xl font-bold text-gray-900">Egyptfi</span>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
              Sign In
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-md">
        {step === "auth" && (
          <Card className="shadow-2xl border-0">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold text-gray-900 mb-2">Create Your Account</CardTitle>
              <p className="text-gray-600">Start accepting crypto payments in minutes</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Wallet Connection */}
              <Button
                onClick={connectWallet}
                disabled={isConnecting}
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                    Connecting Wallet...
                  </>
                ) : (
                  <>
                    <Wallet className="w-5 h-5 mr-3" />
                    Connect Crypto Wallet
                  </>
                )}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Or continue with</span>
                </div>
              </div>

              {/* Google Sign In */}
              <Button
                onClick={signInWithGoogle}
                disabled={isGoogleLoading}
                variant="outline"
                className="w-full h-12 bg-transparent"
              >
                {isGoogleLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </>
                )}
              </Button>

              {/* Benefits */}
              <div className="bg-blue-50 rounded-lg p-4 mt-6">
                <h3 className="font-semibold text-blue-900 mb-3">Why choose Egyptfi?</h3>
                <div className="space-y-2 text-sm text-blue-800">
                  <div className="flex items-center">
                    <Check className="w-4 h-4 mr-2 text-blue-600" />
                    <span>Zero gas fees for your customers</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="w-4 h-4 mr-2 text-blue-600" />
                    <span>Instant USDC settlements</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="w-4 h-4 mr-2 text-blue-600" />
                    <span>Multi-chain payment support</span>
                  </div>
                  <div className="flex items-center">
                    <Check className="w-4 h-4 mr-2 text-blue-600" />
                    <span>Developer-friendly APIs</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-500 text-center">
                By signing up, you agree to our{" "}
                <Link href="/terms" className="text-blue-600 hover:text-blue-700">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-blue-600 hover:text-blue-700">
                  Privacy Policy
                </Link>
              </p>
            </CardContent>
          </Card>
        )}

        {step === "business" && (
          <Card className="shadow-2xl border-0">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900 mb-2">
                {authMethod === "wallet" ? "Wallet Connected!" : "Account Created!"}
              </CardTitle>
              <p className="text-gray-600">Tell us about your business</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="business-name">Business Name</Label>
                <Input id="business-name" placeholder="THeBuidl Kitchen, Kitchen" />
              </div>

              <div>
                <Label htmlFor="business-email">Business Email</Label>
                <Input id="business-email" type="email" placeholder="hello@thebuidlkitchen.com" />
              </div>

              <div>
                <Label htmlFor="business-type">Business Type</Label>
                <select className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm">
                  <option value="">Select business type</option>
                  <option value="retail">Retail Store</option>
                  <option value="restaurant">Restaurant/Cafe</option>
                  <option value="ecommerce">E-commerce</option>
                  <option value="services">Professional Services</option>
                  <option value="saas">SaaS Platforms</option>
                  <option value="nonprofit">Non-profit</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <Label htmlFor="monthly-volume">Expected Monthly Volume</Label>
                <select className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm">
                  <option value="">Select volume range</option>
                  <option value="0-1000">$0 - $1,000</option>
                  <option value="1000-10000">$1,000 - $10,000</option>
                  <option value="10000-50000">$10,000 - $50,000</option>
                  <option value="50000-100000">$50,000 - $100,000</option>
                  <option value="100000+">$100,000+</option>
                </select>
              </div>

              {authMethod === "wallet" && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <Shield className="w-5 h-5 text-green-600 mr-2" />
                    <div>
                      <p className="font-medium text-green-900">Wallet Connected</p>
                      <p className="text-sm text-green-700">0x1234...5678</p>
                    </div>
                  </div>
                </div>
              )}

              <Button onClick={completeSignup} className="w-full bg-gradient-to-r from-blue-600 to-purple-600">
                Complete Setup
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "complete" && (
          <Card className="shadow-2xl border-0">
            <CardContent className="p-8 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome to Egyptfi!</h1>
              <p className="text-gray-600 mb-8">
                Your account has been created successfully. You're being redirected to your dashboard where you can
                start accepting crypto payments.
              </p>

              <div className="bg-blue-50 rounded-lg p-6 mb-6">
                <h3 className="font-semibold text-blue-900 mb-4">What's next?</h3>
                <div className="space-y-3 text-sm text-blue-800">
                  <div className="flex items-center">
                    <Zap className="w-4 h-4 mr-3 text-blue-600" />
                    <span>Create your first payment link</span>
                  </div>
                  <div className="flex items-center">
                    <Shield className="w-4 h-4 mr-3 text-blue-600" />
                    <span>Set up your settlement wallet</span>
                  </div>
                  <div className="flex items-center">
                    <Mail className="w-4 h-4 mr-3 text-blue-600" />
                    <span>Configure webhook notifications</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Redirecting to dashboard...</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
