"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Wallet, Loader2, AlertTriangle } from "lucide-react"
import WalletModal from "@/components/WalletModal"
import AccountModal from "@/components/AccountModal"
import { useAccount } from "@starknet-react/core"
import toast from "react-hot-toast"
import { useAccountDeployment } from "@/hooks/useAccountDeployment"
import { AuthManager } from "@/lib/auth-utils"

export default function LoginPage() {
  const [authMethod, setAuthMethod] = useState<"wallet" | null>(null)
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [hasProcessedConnection, setHasProcessedConnection] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { address, isConnected } = useAccount()
  const router = useRouter()

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

  // Handle wallet connection state changes
  useEffect(() => {
    if (isConnected && address && authMethod === null && showWalletModal === false) {
      console.log("🔧 Fixing authMethod after wallet connection")
      setAuthMethod("wallet")
    }
    
    if (!isConnected && authMethod === "wallet") {
      console.log("🔌 Wallet disconnected, resetting states")
      setAuthMethod(null)
      setHasProcessedConnection(false)
      setIsProcessing(false)
      setError(null)
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
      setIsProcessing(true)
      setError(null)

      // Proceed with authentication even if deployment check fails
      if (!isDeployed && deploymentError) {
        console.log("⚠️ Account deployment check failed:", deploymentError)
        toast.error("Failed to verify wallet deployment. Proceeding with authentication.")
      }

      console.log("✅ Proceeding with authentication for address:", address)
      try {
        // Call the login API
        const response = await fetch('/api/merchants/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress: address })
        });

        const data = await response.json();

        if (!data.success) {
          toast.error(data.error || 'Authentication failed')
          setError(data.error || 'Authentication failed')
          setIsProcessing(false)
          return
        }

        // Store authentication data
        AuthManager.setMerchantInfo({
          id: data.merchant.id,
          businessName: data.merchant.business_name,
          businessEmail: data.merchant.business_email,
          walletAddress: data.merchant.wallet_address,
          createdAt: data.merchant.created_at,
          webhookUrl: data.merchant.webhook,
          phone: data.merchant.phone,
          defaultCurrency: data.merchant.local_currency,
          businessLogo: data.merchant.business_logo
        })

        // Store API keys for both environments
        AuthManager.setApiKeys("testnet", {
          publicKey: data.merchant.apikeys.testnet.public_key,
          // secretKey: data.merchant.apikeys.testnet.secret_key,
          // jwt: data.merchant.apikeys.testnet.jwt
        })

        AuthManager.setApiKeys("mainnet", {
          publicKey: data.merchant.apikeys.mainnet.public_key,
          // secretKey: data.merchant.apikeys.mainnet.secret_key,
          // jwt: data.merchant.apikeys.mainnet.jwt
        })

        AuthManager.setCurrentEnvironment("testnet")

        toast.success("Welcome back! Redirecting to dashboard...")
        setTimeout(() => {
          router.push("/dashboard")
        }, 1500)

      } catch (error) {
        console.error('Login error:', error)
        const errorMessage = error instanceof Error ? error.message : 'An error occurred during authentication'
        toast.error(errorMessage)
        setError(errorMessage)
        setIsProcessing(false)
      }
    }
  }, [authMethod, isConnected, address, hasProcessedConnection, isCheckingDeployment, isDeployed, deploymentError, router])

  // Process wallet connection when conditions are met
  useEffect(() => {
    processWalletConnection()
  }, [processWalletConnection])

  const connectWallet = () => {
    console.log("🚀 Starting wallet connection process")
    setAuthMethod("wallet")
    setHasProcessedConnection(false)
    setIsProcessing(false)
    setError(null)
    setShowWalletModal(true)
  }

  const handleWalletModalClose = () => {
    setShowWalletModal(false)
    setTimeout(() => {
      if (!isConnected) {
        console.log("🔄 Wallet modal closed without connection, resetting auth method")
        setAuthMethod(null)
        setHasProcessedConnection(false)
        setIsProcessing(false)
        setError(null)
      } else {
        console.log("✅ Wallet modal closed with successful connection, preserving auth method")
      }
    }, 100)
  }

  // Computed states
  const isWalletProcessing = authMethod === "wallet" && isConnected && address && (!hasProcessedConnection || isCheckingDeployment || isProcessing)
  
  // Get current error message
  const currentError = error || (deploymentError && "Failed to verify wallet deployment. Please try again or contact support.")

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back to home link */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to home
          </Link>
        </div>

        {/* Error Display */}
        {currentError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
              <p className="text-red-800 text-sm">{currentError}</p>
              {deploymentError && (
                <Button
                  variant="link"
                  className="ml-2 text-blue-600"
                  onClick={retryDeploymentCheck}
                >
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
                <p className="font-medium text-blue-900">Authenticating wallet...</p>
                <p className="text-sm text-blue-700">
                  {!hasProcessedConnection && "Initializing..."}
                  {hasProcessedConnection && isCheckingDeployment && "Checking account deployment..."}
                  {hasProcessedConnection && !isCheckingDeployment && isProcessing && "Authenticating..."}
                </p>
              </div>
            </div>
          </div>
        )}

        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center pb-6">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">N</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">Nummus</span>
            </div>

            <CardTitle className="text-2xl font-bold text-gray-900">Welcome back</CardTitle>
            <CardDescription className="text-gray-600">Sign in with your crypto wallet to continue</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <Button
              onClick={connectWallet}
              disabled={isWalletProcessing}
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {isWalletProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <Wallet className="w-5 h-5 mr-3" />
                  Connect Crypto Wallet
                </>
              )}
            </Button>

            <div className="text-center text-sm text-gray-600">
              Don't have an account?{" "}
              <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-medium transition-colors">
                Sign up
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-xs text-gray-500">
          By signing in, you agree to our{" "}
          <Link href="/terms" className="text-blue-600 hover:text-blue-700 transition-colors">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-blue-600 hover:text-blue-700 transition-colors">
            Privacy Policy
          </Link>
        </div>
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