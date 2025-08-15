"use client"

import { useState, useEffect, useMemo } from "react"
import { ArrowLeft, Wallet, Mail, Check, Loader2, Shield, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { useRouter } from "next/navigation"
import WalletModal from "@/components/WalletModal"
import AccountModal from "@/components/AccountModal"
import { useAccount } from "@starknet-react/core"
import toast from "react-hot-toast"
import {
  useContract,
  usePaymasterEstimateFees,
  usePaymasterGasTokens,
  usePaymasterSendTransaction,
  useTransactionReceipt,
} from "@starknet-react/core";
import { EGYPTFI_ABI } from "@/lib/abi";
import { EGYPT_SEPOLIA_CONTRACT_ADDRESS } from "@/lib/utils";
import { STRK_SEPOLIA } from "@/lib/coins";
import { FeeMode } from "starknet";
import { stringToFelt252, emailToFelt252, truncateToFelt252 } from "@/lib/felt252-utils";

interface MerchantData {
  business_name: string
  business_email: string
  business_type: string
  monthly_volume: string
}

export default function SignupPage() {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCheckingMerchant, setIsCheckingMerchant] = useState(false)
  const [isRegisteringOnchain, setIsRegisteringOnchain] = useState(false)
  const [step, setStep] = useState<"auth" | "business" | "complete">("auth")
  const [authMethod, setAuthMethod] = useState<"wallet" | "google" | null>(null)
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [merchantData, setMerchantData] = useState<MerchantData>({
    business_name: "",
    business_email: "",
    business_type: "",
    monthly_volume: ""
  })
  const [merchantDbData, setMerchantDbData] = useState<any>(null)

  const { address, isConnected } = useAccount()
  const router = useRouter()

  // Contract setup for register_merchant
  const { contract } = useContract({
    abi: EGYPTFI_ABI,
    address: EGYPT_SEPOLIA_CONTRACT_ADDRESS,
  });

  const feeMode: FeeMode = {
    mode: "sponsored",
  };

  // Prepare contract calls for register_merchant
  const calls = useMemo(() => {
    if (!contract || !merchantDbData || !address) {
      return undefined;
    }
    
    try {
      // Convert string data to felt252 format
      const nameAsFelt = truncateToFelt252(merchantDbData.business_name);
      const emailAsFelt = emailToFelt252(merchantDbData.business_email);
      const withdrawalAddress = address; // Use connected wallet as withdrawal address
      const feePercentage = 250; // 2.5% as basis points (250/10000 = 2.5%)

      console.log("Contract call data:", {
        nameAsFelt,
        emailAsFelt,
        withdrawalAddress,
        feePercentage
      });

      return [contract.populate("register_merchant", [
        nameAsFelt,
        emailAsFelt,
        withdrawalAddress,
        feePercentage
      ])];
    } catch (error) {
      console.error("Error preparing contract calls:", error);
      toast.error("Error preparing blockchain registration");
      return undefined;
    }
  }, [contract, merchantDbData, address]);

  // Paymaster hooks for gas estimation and transaction
  const {
    data: estimateData,
    isPending: isPendingEstimate,
    error: errorEstimate,
  } = usePaymasterEstimateFees({
    calls,
    options: {
      feeMode,
    },
  });

  const {
    sendAsync: sendGasless,
    data: sendData,
    isPending: isPendingSend,
    error: errorSend,
  } = usePaymasterSendTransaction({
    calls,
    options: {
      feeMode,
    },
    maxFeeInGasToken: estimateData?.suggested_max_fee_in_gas_token,
  });

  const {
    isLoading: waitIsLoading,
    data: waitData,
    status: txStatus,
    isError: isTxError,
    error: txError,
  } = useTransactionReceipt({
    hash: sendData?.transaction_hash,
    watch: true,
  });

  // Check if merchant is already registered when wallet connects
  useEffect(() => {
    console.log(authMethod);    
    if (isConnected && address && authMethod === "wallet") {
      checkExistingMerchant(address)
    }
  }, [isConnected, address, authMethod])

  // Handle successful on-chain registration
  useEffect(() => {
    if (txStatus === "success" && waitData) {
      toast.success("Merchant registered on-chain successfully!")
      setStep("complete")
      
      // Store merchant info and redirect
      setTimeout(() => {
        router.push("/dashboard")
      }, 3000)
    } else if (txStatus === "error" || isTxError) {
      toast.error("On-chain registration failed. Please try again.")
      console.error("Transaction error:", txError)
      setIsRegisteringOnchain(false)
    }
  }, [txStatus, waitData, isTxError, txError, router])

  const checkExistingMerchant = async (walletAddress: string) => {
    console.log("registering");
    
    setIsCheckingMerchant(true)
    try {
      const response = await fetch(`/api/merchants/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ walletAddress }),
      })

      const data = await response.json()

      if (response.ok && data.exists) {
        // Merchant already exists, store their tokens and redirect to dashboard
        toast.success("Welcome back! Redirecting to dashboard...")
        // You can store the merchant info in localStorage or context here
        localStorage.setItem('merchant', JSON.stringify(data.merchant))
        setTimeout(() => {
          router.push("/dashboard")
        }, 1500)
      } else {
        // New merchant, proceed to business info form
        setStep("business")
        toast.success("Wallet connected successfully!")
      }
    } catch (error) {
      console.error("Error checking merchant:", error)
      toast.error("Failed to check merchant status. Please try again.")
    } finally {
      setIsCheckingMerchant(false)
    }
  }

  const connectWallet = () => {
    setAuthMethod("wallet")
    setShowWalletModal(true)
  }

  const signInWithGoogle = async () => {
    setIsGoogleLoading(true)
    setAuthMethod("google")
    // Simulate Google OAuth - replace with actual Google OAuth implementation
    setTimeout(() => {
      setIsGoogleLoading(false)
      setStep("business")
      toast.success("Google account connected successfully!")
    }, 1500)
  }

  const handleInputChange = (field: keyof MerchantData, value: string) => {
    setMerchantData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const validateForm = (): boolean => {
    const { business_name, business_email, business_type, monthly_volume } = merchantData
    
    if (!business_name.trim()) {
      toast.error("Business name is required")
      return false
    }
    
    if (!business_email.trim()) {
      toast.error("Business email is required")
      return false
    }
    
    if (!/\S+@\S+\.\S+/.test(business_email)) {
      toast.error("Please enter a valid email address")
      return false
    }
    
    if (!business_type) {
      toast.error("Please select a business type")
      return false
    }
    
    if (!monthly_volume) {
      toast.error("Please select expected monthly volume")
      return false
    }
    
    return true
  }

  const registerMerchantOnChain = async () => {
    if (!calls || !merchantDbData) {
      toast.error("Unable to prepare transaction")
      return
    }

    try {
      setIsRegisteringOnchain(true)
      toast.loading("Registering merchant on-chain...")
      await sendGasless()
    } catch (error) {
      console.error("Error registering merchant on-chain:", error)
      toast.error("Failed to register merchant on-chain")
      setIsRegisteringOnchain(false)
    }
  }

  const completeSignup = async () => {
    if (!validateForm()) return

    setIsSubmitting(true)
    
    try {
      const payload = {
        ...merchantData,
        wallet_address: authMethod === "wallet" ? address : null,
        authMethod,
        local_currency: "USD", // Default currency, can be made configurable
      }

      console.log("Payload", payload);      

      const response = await fetch('/api/merchants/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      console.log("Response", data);
      

      if (response.ok) {
        setStep("complete")
        toast.success("Account created successfully!")
        
        // Store merchant info and API keys securely
        localStorage.setItem('merchant', JSON.stringify(data.merchant))
        
        // Store API keys (in production, handle these more securely)
        // Get from Data endpoints
        localStorage.setItem('testnet_keys', JSON.stringify({
          publicKey: data.apiKeys.testnet.publicKey,
          jwt: data.apiKeys.testnet.jwt
        }))
        
        localStorage.setItem('mainnet_keys', JSON.stringify({
          publicKey: data.apiKeys.mainnet.publicKey,
          jwt: data.apiKeys.mainnet.jwt
        }))
        
        // Show secret keys in a secure modal (implement this)
        console.log('IMPORTANT - Store these secret keys securely:', {
          testnet: data.apiKeys.testnet.secretKey,
          mainnet: data.apiKeys.mainnet.secretKey
        })
        
        // Store merchant data for on-chain registration
        setMerchantDbData(data.merchant)
        
        // If wallet is connected, register on-chain
        if (authMethod === "wallet" && address) {
          // The on-chain registration will be triggered by the useEffect when merchantDbData is set
          toast.loading("Now registering on blockchain...")
        } else {
          // If no wallet, go directly to complete step
          setStep("complete")
          setTimeout(() => {
            router.push("/dashboard")
          }, 3000)
        }
      } else {
        toast.error(data.error || "Failed to create account. Please try again.")
      }
    } catch (error) {
      console.error("Error creating merchant account:", error)
      toast.error("Failed to create account. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

   // Trigger on-chain registration when merchant data is available
  useEffect(() => {
    if (merchantDbData && authMethod === "wallet" && address && !isRegisteringOnchain && !sendData) {
      registerMerchantOnChain()
    }
  }, [merchantDbData, authMethod, address, isRegisteringOnchain, sendData])


  const handleWalletModalClose = () => {
    setShowWalletModal(false)
    if (!isConnected) {
      setAuthMethod("wallet")
    }
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
                <span className="text-white font-bold text-sm">N</span>
              </div>
              <span className="text-xl font-bold text-gray-900">Nummus</span>
            </div>
          </div>
          <div className="text-sm text-gray-500 flex items-center gap-4">
            {isConnected && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowAccountModal(true)}
                className="text-xs"
              >
                <Wallet className="w-3 h-3 mr-1" />
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </Button>
            )}
            <div>
              Already have an account?{" "}
              <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                Sign In
              </Link>
            </div>
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
                disabled={isCheckingMerchant}
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {isCheckingMerchant ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                    Checking Account...
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
                <h3 className="font-semibold text-blue-900 mb-3">Why choose Nummus?</h3>
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
                <Label htmlFor="business-name">Business Name *</Label>
                <Input 
                  id="business-name" 
                  placeholder="Coffee Shop Lagos" 
                  value={merchantData.business_name}
                  onChange={(e) => handleInputChange("business_name", e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="business-email">Business Email *</Label>
                <Input 
                  id="business-email" 
                  type="email" 
                  placeholder="hello@coffeeshop.com" 
                  value={merchantData.business_email}
                  onChange={(e) => handleInputChange("business_email", e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="business-type">Business Type *</Label>
                <select 
                  className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
                  value={merchantData.business_type}
                  onChange={(e) => handleInputChange("business_type", e.target.value)}
                >
                  <option value="">Select business type</option>
                  <option value="retail">Retail Store</option>
                  <option value="restaurant">Restaurant/Cafe</option>
                  <option value="ecommerce">E-commerce</option>
                  <option value="services">Professional Services</option>
                  <option value="nonprofit">Non-profit</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <Label htmlFor="monthly-volume">Expected Monthly Volume *</Label>
                <select 
                  className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm"
                  value={merchantData.monthly_volume}
                  onChange={(e) => handleInputChange("monthly_volume", e.target.value)}
                >
                  <option value="">Select volume range</option>
                  <option value="0-1000">$0 - $1,000</option>
                  <option value="1000-10000">$1,000 - $10,000</option>
                  <option value="10000-50000">$10,000 - $50,000</option>
                  <option value="50000-100000">$50,000 - $100,000</option>
                  <option value="100000+">$100,000+</option>
                </select>
              </div>

              {authMethod === "wallet" && address && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <Shield className="w-5 h-5 text-green-600 mr-2" />
                    <div>
                      <p className="font-medium text-green-900">Wallet Connected</p>
                      <p className="text-sm text-green-700 font-mono">{address.slice(0, 10)}...{address.slice(-8)}</p>
                    </div>
                  </div>
                </div>
              )}

              <Button 
                onClick={completeSignup} 
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  "Complete Setup"
                )}
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
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome to Nummus!</h1>
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

      {/* Wallet Modal */}
      <WalletModal 
        isOpen={showWalletModal} 
        onClose={handleWalletModalClose}
      />

      {/* Account Modal */}
      <AccountModal 
        isOpen={showAccountModal} 
        onClose={() => setShowAccountModal(false)}
      />
    </div>
  )
}