"use client"

import { useState, useEffect, useCallback } from "react"
import { ArrowLeft, Wallet, Mail, Check, Loader2, Shield, Zap, AlertTriangle, RefreshCw, Wifi } from "lucide-react"
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
import { useAccountDeployment } from "@/hooks/useAccountDeployment"
import { useMerchantStatus } from "@/hooks/useMerchantStatus"
import { useMerchantRegistration } from "@/hooks/useMerchantRegistration"
import { MerchantRegistrationData } from "@/services/merchantRegistrationService"
import { useGlobalNetworkStatus } from "@/components/NetworkStatusProvider"
import { PaymentModeIndicator } from "@/components/PaymentModeIndicator"

interface MerchantData {
  business_name: string
  business_email: string
  business_type: string
  monthly_volume: string
}

export default function SignupPage() {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [step, setStep] = useState<"auth" | "business" | "complete">("auth")
  const [authMethod, setAuthMethod] = useState<"wallet" | "google" | null>(null)
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [hasProcessedConnection, setHasProcessedConnection] = useState(false)
  const [walletProcessingComplete, setWalletProcessingComplete] = useState(false) // NEW: Track when wallet processing is done
  const [deploymentCheckFailed, setDeploymentCheckFailed] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [merchantData, setMerchantData] = useState<MerchantData>({
    business_name: "",
    business_email: "",
    business_type: "",
    monthly_volume: ""
  })

  const { address, isConnected } = useAccount()
  const router = useRouter()
  const networkStatus = useGlobalNetworkStatus()

  // Check account deployment status
  const {
    isDeployed,
    isLoading: isCheckingDeployment,
    error: deploymentError,
    retryDeploymentCheck,
  } = useAccountDeployment(
    address && authMethod === "wallet" ? address : undefined,
    'sepolia',
    true
  )

  // Check merchant status (contract first, then database)
  const {
    isLoading: isCheckingMerchant,
    contractCheck,
    dbCheck,
    isContractMerchant,
    isDbMerchant,
    error: merchantCheckError,
    checkMerchantStatus,
    resetStatus,
  } = useMerchantStatus()

  // Handle merchant registration
  const {
    isRegistering,
    isContractRegistering,
    isVerifying,
    registrationStep,
    error: registrationError,
    registerMerchant,
    resetRegistration,
  } = useMerchantRegistration()

  // Handle deployment check failures and network issues
  useEffect(() => {
    if (deploymentError && !networkStatus.isOnline) {
      setDeploymentCheckFailed(true)
      toast.error("Account deployment check failed due to network issues. Please check your connection and retry.")
    } else if (deploymentError && networkStatus.isSlowConnection) {
      setDeploymentCheckFailed(true)
      toast.error("Account deployment check failed due to slow connection. Please retry.")
    } else if (deploymentError) {
      setDeploymentCheckFailed(true)
      toast.error("Account deployment check failed. Please retry.")
    } else {
      setDeploymentCheckFailed(false)
    }
  }, [deploymentError, networkStatus.isOnline, networkStatus.isSlowConnection])

  // Retry deployment check function
  const handleRetryDeploymentCheck = useCallback(async () => {
    if (!networkStatus.isOnline) {
      toast.error("Please check your internet connection before retrying")
      return
    }

    setRetryCount(prev => prev + 1)
    setDeploymentCheckFailed(false)
    
    try {
      retryDeploymentCheck()
      toast.success("Retrying account deployment check...")
    } catch (error) {
      console.error("Retry failed:", error)
      setDeploymentCheckFailed(true)
    }
  }, [networkStatus.isOnline, retryDeploymentCheck])

  // Handle wallet connection state changes
  useEffect(() => {
    if (isConnected && address && authMethod === null && showWalletModal === false) {
      // Wallet connected but authMethod wasn't set properly
      console.log("🔧 Fixing authMethod after wallet connection")
      setAuthMethod("wallet")
    }
    
    if (!isConnected && authMethod === "wallet") {
      // Wallet disconnected, reset states
      console.log("🔌 Wallet disconnected, resetting states")
      setAuthMethod(null)
      setHasProcessedConnection(false)
      setWalletProcessingComplete(false) // Reset processing complete flag
      setDeploymentCheckFailed(false)
      setRetryCount(0)
      setStep("auth")
    }
  }, [isConnected, address, authMethod, showWalletModal])

  // Handle wallet connection completion
  const processWalletConnection = useCallback(async () => {
    if (
      authMethod === "wallet" && 
      isConnected && 
      address && 
      !hasProcessedConnection &&
      !isCheckingDeployment
    ) {
      console.log("🔄 Processing wallet connection for address:", address)
      setHasProcessedConnection(true)

      // Wait for deployment check to complete
      if (isDeployed) {
        console.log("✅ Account is deployed, checking merchant status...")
        await checkMerchantStatus(address)
      } else {
        console.log("⚠️ Account not deployed, skipping to business form")
        setStep("business")
        setWalletProcessingComplete(true) // Mark processing as complete
        // Reset registration states to ensure clean state
        resetRegistration()
        toast.success("Wallet connected! (Blockchain registration will be skipped)")
      }
    }
  }, [authMethod, isConnected, address, hasProcessedConnection, isCheckingDeployment, isDeployed, checkMerchantStatus])

  // Process wallet connection when conditions are met
  useEffect(() => {
    processWalletConnection()
  }, [processWalletConnection])

  // Handle merchant status check results
  useEffect(() => {
    if (
      authMethod === "wallet" &&
      hasProcessedConnection &&
      contractCheck !== null && 
      dbCheck !== null && 
      !isCheckingMerchant
    ) {
      console.log("📊 Merchant status check complete:", {
        contractExists: isContractMerchant,
        dbExists: isDbMerchant,
        contractData: contractCheck,
        dbData: dbCheck,
      })

      if (isContractMerchant || isDbMerchant) {
        // Existing merchant found
        const merchantData = dbCheck.merchant || contractCheck.merchant
        
        toast.success("Welcome back! Redirecting to dashboard...")

        console.log("merchantData", merchantData)
        
        // Store merchant data if from database
        if (dbCheck.merchant) {
          localStorage.setItem('merchant', JSON.stringify(dbCheck.merchant))
        }
        
        setTimeout(() => {
          router.push("/dashboard")
        }, 1500)
      } else {
        // New merchant, proceed to business info form
        console.log("👤 New merchant detected, showing business form")
        setStep("business")
        setWalletProcessingComplete(true) // Mark processing as complete
        // Reset registration states to ensure clean state
        resetRegistration()
        toast.success("Wallet connected successfully!")
      }
    }
  }, [
    authMethod,
    hasProcessedConnection,
    contractCheck, 
    dbCheck, 
    isCheckingMerchant, 
    isContractMerchant, 
    isDbMerchant, 
    router
  ])

  // Force reset registration states when reaching business step
  useEffect(() => {
    if (step === "business" && (isRegistering || isContractRegistering || isVerifying) && registrationStep === 'idle') {
      console.log("🔄 Force resetting stuck registration states")
      resetRegistration()
    }
  }, [step, isRegistering, isContractRegistering, isVerifying, registrationStep, resetRegistration])

  // Handle registration completion
  useEffect(() => {
    if (registrationStep === 'complete') {
      setStep("complete")
      
      setTimeout(() => {
        router.push("/dashboard")
      }, 3000)
    }
  }, [registrationStep, router])

  const connectWallet = () => {
    console.log("🚀 Starting wallet connection process")
    setAuthMethod("wallet")
    setHasProcessedConnection(false)
    setWalletProcessingComplete(false) // Reset processing complete flag
    resetStatus()
    resetRegistration()
    setShowWalletModal(true)
  }

  const signInWithGoogle = async () => {
    setIsGoogleLoading(true)
    setAuthMethod("google")
    setHasProcessedConnection(false)
    setWalletProcessingComplete(true) // Google doesn't need wallet processing
    resetStatus()
    resetRegistration()
    
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

  const completeSignup = async () => {
    if (!validateForm()) return

    // Check if wallet processing is still ongoing (only for wallet auth method)
    if (authMethod === "wallet" && !walletProcessingComplete) {
      toast.error("Please wait for wallet connection to complete")
      return
    }

    // If wallet method is selected but deployment check is still running
    if (authMethod === "wallet" && address && isCheckingDeployment) {
      toast.error("Please wait for account verification to complete")
      return
    }

    if (authMethod !== "wallet" && authMethod !== "google") {
      toast.error("Authentication method is required")
      return
    }

    const registrationData: MerchantRegistrationData = {
      ...merchantData,
      wallet_address: authMethod === "wallet" ? address : undefined,
      authMethod: authMethod,
      local_currency: "NGN",
    }

    const success = await registerMerchant(registrationData, address, isDeployed)
    
    if (!success) {
      return
    }

    // If registration doesn't require contract registration, complete immediately
    if (registrationStep === 'complete' || (authMethod !== "wallet" || !isDeployed)) {
      setStep("complete")
      setTimeout(() => {
        router.push("/dashboard")
      }, 3000)
    }
  }

  const handleWalletModalClose = () => {
    setShowWalletModal(false)
    // Only reset auth method if wallet didn't connect
    // Use a small delay to ensure isConnected state has updated
    setTimeout(() => {
      if (!isConnected) {
        console.log("🔄 Wallet modal closed without connection, resetting auth method")
        setAuthMethod(null)
        setHasProcessedConnection(false)
        setWalletProcessingComplete(false)
      } else {
        console.log("✅ Wallet modal closed with successful connection, preserving auth method")
      }
    }, 100)
  }

  // Computed states
  const isWalletProcessing = authMethod === "wallet" && isConnected && address && (!hasProcessedConnection || isCheckingDeployment || isCheckingMerchant) && !walletProcessingComplete
  const isRegistrationInProgress = isRegistering && isContractRegistering || isVerifying
  
  // FIXED: Only disable the button during actual registration, not during wallet processing
  // Also check if we're actually in the middle of submitting (registrationStep should not be 'idle' during real registration)
  const isActuallyRegistering = isRegistrationInProgress && registrationStep !== 'idle'
  const isCompleteSetupDisabled = isActuallyRegistering || 
    (authMethod === "wallet" && !walletProcessingComplete) ||
    (authMethod === "wallet" && deploymentCheckFailed) ||
    !networkStatus.isOnline

  // Get current registration status message
  const getRegistrationStatusMessage = () => {
    switch (registrationStep) {
      case 'database':
        return 'Creating account...'
      case 'contract':
        return 'Registering on blockchain...'
      case 'verification':
        return 'Verifying registration...'
      default:
        return 'Complete Setup'
    }
  }

  // Get current error message
  const currentError = registrationError || merchantCheckError || (deploymentError && "Account deployment check failed")

  // console.log("🛠 Debug state:", {
  //   step,
  //   authMethod,
  //   isConnected,
  //   address: address?.slice(0, 6) + "..." + address?.slice(-4),
  //   hasProcessedConnection,
  //   walletProcessingComplete,
  //   isCheckingDeployment,
  //   isDeployed,
  //   isCheckingMerchant,
  //   contractCheck: contractCheck?.exists || contractCheck,
  //   dbCheck: dbCheck?.exists || dbCheck,
  //   isWalletProcessing,
  //   isCompleteSetupDisabled,
  //   // Add these to debug the registration states
  //   isRegistering,
  //   isContractRegistering,
  //   isVerifying,
  //   registrationStep,
  //   isRegistrationInProgress,
  //   isActuallyRegistering
  // })

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
              <span className="text-xl font-bold text-gray-900">EgyptFi</span>
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
        {/* Network Status Display */}
        {(!networkStatus.isOnline || networkStatus.isSlowConnection) && (
          <div className={`mb-4 p-4 rounded-lg border ${
            !networkStatus.isOnline 
              ? 'bg-red-50 border-red-200' 
              : 'bg-orange-50 border-orange-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {!networkStatus.isOnline ? (
                  <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
                ) : (
                  <Wifi className="w-5 h-5 text-orange-600 mr-2" />
                )}
                <div>
                  <p className={`font-medium text-sm ${
                    !networkStatus.isOnline ? 'text-red-800' : 'text-orange-800'
                  }`}>
                    {networkStatus.getStatusMessage()}
                  </p>
                  {networkStatus.latency && (
                    <p className="text-xs text-gray-600">
                      Connection latency: {Math.round(networkStatus.latency)}ms
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={networkStatus.checkNetworkStatus}
                disabled={networkStatus.isChecking}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className={`h-4 w-4 ${
                  networkStatus.isChecking ? 'animate-spin' : ''
                }`} />
              </Button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {currentError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
                <div>
                  <p className="text-red-800 text-sm">{currentError}</p>
                  {deploymentCheckFailed && retryCount > 0 && (
                    <p className="text-xs text-red-600 mt-1">
                      Retry attempt: {retryCount}
                    </p>
                  )}
                </div>
              </div>
              {deploymentCheckFailed && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRetryDeploymentCheck}
                  disabled={!networkStatus.isOnline || isCheckingDeployment}
                  className="h-8 px-3 text-red-600 hover:text-red-700"
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${
                    isCheckingDeployment ? 'animate-spin' : ''
                  }`} />
                  Retry
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Processing Status */}
        {isWalletProcessing && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center">
              <Loader2 className="w-5 h-5 text-blue-600 mr-2 animate-spin" />
              <div>
                <p className="font-medium text-blue-900">Processing wallet connection...</p>
                <p className="text-sm text-blue-700">
                  {!hasProcessedConnection && "Initializing..."}
                  {hasProcessedConnection && isCheckingDeployment && "Checking account deployment..."}
                  {hasProcessedConnection && !isCheckingDeployment && isCheckingMerchant && "Checking merchant status..."}
                </p>
              </div>
            </div>
          </div>
        )}

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
                disabled={isWalletProcessing}
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {isWalletProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                    Processing...
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
                  <span className="bg-white px-2 text-gray-500">Wallet must have activity (sent/received STRK)</span>
                </div>
              </div>

              {/* Benefits */}
              <div className="bg-blue-50 rounded-lg p-4 mt-6">
                <h3 className="font-semibold text-blue-900 mb-3">Why choose EgyptFi?</h3>
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
                  disabled={isRegistrationInProgress}
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
                  disabled={isRegistrationInProgress}
                />
              </div>

              <div>
                <Label htmlFor="business-type">Business Type *</Label>
                <select 
                  className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm disabled:opacity-50"
                  value={merchantData.business_type}
                  onChange={(e) => handleInputChange("business_type", e.target.value)}
                  disabled={isRegistrationInProgress}
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
                  className="w-full h-10 px-3 py-2 border border-input bg-background rounded-md text-sm disabled:opacity-50"
                  value={merchantData.monthly_volume}
                  onChange={(e) => handleInputChange("monthly_volume", e.target.value)}
                  disabled={isRegistrationInProgress}
                >
                  <option value="">Select volume range</option>
                  <option value="0-1000">$0 - $1,000</option>
                  <option value="1000-10000">$1,000 - $10,000</option>
                  <option value="10000-50000">$10,000 - $50,000</option>
                  <option value="50000-100000">$50,000 - $100,000</option>
                  <option value="100000+">$100,000+</option>
                </select>
              </div>

              {/* Wallet Status Display */}
              {authMethod === "wallet" && address && (
                <div className={`border rounded-lg p-4 ${
                  isDeployed 
                    ? "bg-green-50 border-green-200" 
                    : "bg-orange-50 border-orange-200"
                }`}>
                  <div className="flex items-center">
                    {isDeployed ? (
                      <Shield className="w-5 h-5 text-green-600 mr-2" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-orange-600 mr-2" />
                    )}
                    <div>
                      <p className={`font-medium ${
                        isDeployed ? "text-green-900" : "text-orange-900"
                      }`}>
                        {isDeployed ? "Wallet Connected & Deployed" : "Wallet Connected (Not Deployed)"}
                      </p>
                      <p className="text-sm text-gray-700 font-mono">
                        {address.slice(0, 10)}...{address.slice(-8)}
                      </p>
                      {!isDeployed && (
                        <p className="text-xs text-orange-700 mt-1">
                          Blockchain registration will be skipped
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Mode Indicator */}
              {authMethod === "wallet" && address && isDeployed && (
                <PaymentModeIndicator showDetails={false} />
              )}

              {/* Registration Progress */}
              {isRegistrationInProgress && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <Loader2 className="w-5 h-5 text-blue-600 mr-2 animate-spin" />
                    <div>
                      <p className="font-medium text-blue-900">
                        {getRegistrationStatusMessage()}
                      </p>
                      <div className="text-xs text-blue-700 mt-1">
                        {registrationStep === 'database' && "Setting up your account..."}
                        {registrationStep === 'contract' && "Submitting blockchain transaction..."}
                        {registrationStep === 'verification' && "Confirming on-chain registration..."}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Button 
                onClick={completeSignup} 
                disabled={isCompleteSetupDisabled}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600"
              >
                {isRegistrationInProgress ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {getRegistrationStatusMessage()}
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
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome to EgyptFi!</h1>
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