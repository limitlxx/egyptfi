"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Wallet, Check, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import toast from "react-hot-toast";
import WalletConnection from "@/components/WalletConnection";
import { useWallet } from "@/hooks/useWallet";
import { usePaymaster } from "@/hooks/usePayMaster";
import { get_payment, prepare_payment_call, update_payment_status } from "@/services/paymentService";
import { EGYPT_SEPOLIA_CONTRACT_ADDRESS } from "@/lib/utils";

export default function PaymentPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const payment_ref = searchParams.get("ref");
  const redirect_to = searchParams.get("redirect");
  const { isConnected, address } = useWallet();

  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChain, setSelectedChain] = useState("starknet");
  const [selectedToken, setSelectedToken] = useState("usdc");
  const [convertedAmount, setConvertedAmount] = useState<string | null>(null);
  const [isPriceLoading, setIsPriceLoading] = useState(false);
  const [isPaying, setIsPaying] = useState(false);

  if (!payment_ref) {
  throw new Error("Missing payment reference");
}

  const chains = [
    { id: "starknet", name: "StarkNet", icon: "⬟" },
    { id: "ethereum", name: "Ethereum", icon: "⟠" },
    { id: "polygon", name: "Polygon", icon: "⬢" },
  ];

  const tokens = {
    starknet: [
      { id: "usdc", name: "USDC", address: "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8" },
      { id: "eth", name: "ETH", address: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" },
    ],
    ethereum: [
      { id: "usdc", name: "USDC", address: "0x...ethereum_usdc" }, // Replace
      { id: "eth", name: "ETH", address: "0x...ethereum_eth" }, // Replace
    ],
    polygon: [
      { id: "usdc", name: "USDC", address: "0x...polygon_usdc" }, // Replace
      { id: "matic", name: "MATIC", address: "0x...polygon_matic" }, // Replace
    ],
  };

  const selectedTokenData =
    selectedChain && selectedToken
      ? tokens[selectedChain as keyof typeof tokens]?.find((t) => t.id === selectedToken)
      : null;

  useEffect(() => {
    if (!payment_ref) {
      setError("Invalid payment reference");
      setIsLoading(false);
      return;
    }
    fetchInvoiceData();
  }, [payment_ref]);

  const fetchInvoiceData = async () => {
    try {
      setIsLoading(true);
      const data = await get_payment(payment_ref);
      if (data.status === "paid") {
        if (redirect_to) {
          window.location.href = decodeURIComponent(redirect_to);
        } else {
          router.push(`/confirm?ref=${payment_ref}`);
        }
        return;
      }
      setInvoiceData(data);
    } catch (err) {
      setError("Failed to load payment information");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPrice = async () => {
    if (!selectedChain || !selectedToken || selectedChain !== "starknet") return;
    try {
      setIsPriceLoading(true);
      const response = await fetch(
        `/api/payments/price?token=${selectedToken}&chain=${selectedChain}&fiat_amount=${invoiceData?.amount}&fiat_currency=${invoiceData?.currency}`
      );
      if (!response.ok) throw new Error("Failed to fetch price");
      const result = await response.json();
      setConvertedAmount(result.data.converted_amount[selectedToken.toUpperCase()]);
    } catch (err) {
      toast.error("Failed to update price");
    } finally {
      setIsPriceLoading(false);
    }
  };

  useEffect(() => {
    if (invoiceData && selectedChain && selectedToken) {
      fetchPrice();
      const interval = setInterval(fetchPrice, 10000);
      return () => clearInterval(interval);
    }
  }, [invoiceData, selectedChain, selectedToken]);

  const paymentCall = prepare_payment_call({
    payment_ref,
    amount: invoiceData?.amount || 0,
    token_address: selectedTokenData?.address || "",
    contract_address: EGYPT_SEPOLIA_CONTRACT_ADDRESS,
    caller: address || "",
  });

  const { executeTransaction, isSuccess, transactionHash, isError, txError: txError } = usePaymaster({
    calls: [paymentCall],
    enabled: isConnected && !!selectedTokenData && !!invoiceData,
    onSuccess: (txHash) => {
      toast.success(`Payment processed: ${txHash}`);
      update_payment_status({ payment_ref, status: "paid", tx_hash: txHash });
      if (redirect_to) {
        window.location.href = decodeURIComponent(redirect_to);
      } else {
        router.push(`/confirm?ref=${payment_ref}`);
      }
    },
    // onError: (err) => toast.error(`Payment failed: ${err.message}`),
    onError: (err) => console.log(`Payment failed: ${err.message}`)
    
  });

  const handlePayment = async () => {
    if (!isConnected || !address) {
      toast.error("Please connect wallet first");
      return;
    }
    if (!selectedTokenData) {
      toast.error("Please select a token");
      return;
    }
    setIsPaying(true);
    try {
      await executeTransaction();
    } catch (err) {
      toast.error("Payment failed");
    } finally {
      setIsPaying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading payment information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Payment Error</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4">
      <div className="container mx-auto max-w-2xl">
        <div className="flex items-center mb-8">
          {/* <Button variant="ghost" size="sm" asChild className="mr-4">
            <Link href={`/invoice/${payment_ref}`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Invoice
            </Link>
          </Button> */}
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            Payment
          </Badge>
        </div>

        <Card className="shadow-2xl border-0">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center text-2xl mx-auto mb-4">
                {invoiceData?.merchant_logo ? (
                  <img src={invoiceData.merchant_logo} alt="Merchant logo" className="w-full h-full object-cover rounded-xl" />
                ) : (
                  "☕"
                )}
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Complete Payment</h1>
              <p className="text-gray-500">{invoiceData?.merchant_name} • {invoiceData?.currency}{invoiceData?.amount.toLocaleString()}</p>
            </div>

            {!isConnected ? (
              <div className="text-center mb-8">
                <div className="bg-gray-50 rounded-xl p-8 mb-6">
                  <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Connect Your Wallet</h3>
                  <p className="text-gray-500 mb-6">Connect your crypto wallet to complete the payment</p>
                  <WalletConnection />
                </div>
              </div>
            ) : (
              <>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center">
                    <Check className="w-5 h-5 text-green-600 mr-2" />
                    <div>
                      <p className="font-medium text-green-900">Wallet Connected</p>
                      <p className="text-sm text-green-700">{address}</p>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Network</label>
                  <Select value={selectedChain} onValueChange={setSelectedChain}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a blockchain network" />
                    </SelectTrigger>
                    <SelectContent>
                      {chains.map((chain) => (
                        <SelectItem key={chain.id} value={chain.id}>
                          <div className="flex items-center">
                            <span className="mr-2">{chain.icon}</span>
                            {chain.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedChain && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Token</label>
                    <Select value={selectedToken} onValueChange={setSelectedToken}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose a token to pay with" />
                      </SelectTrigger>
                      <SelectContent>
                        {tokens[selectedChain as keyof typeof tokens]?.map((token) => (
                          <SelectItem key={token.id} value={token.id}>
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center">
                                {/* <span className="mr-2">{token.icon}</span> */}
                                {token.name}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedTokenData && (
                  <div className="bg-gray-50 rounded-xl p-6 mb-6">
                    <h3 className="font-semibold text-gray-900 mb-4">Payment Summary</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Amount ({invoiceData?.currency})</span>
                        <span className="font-medium">{invoiceData?.currency}{invoiceData?.amount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">You Pay</span>
                        <span className="font-medium">
                          {isPriceLoading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : convertedAmount || "N/A"} {selectedTokenData.name}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Network</span>
                        <span className="font-medium">{chains.find((c) => c.id === selectedChain)?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Gas Fees</span>
                        <span className="font-medium text-green-600">Free</span>
                      </div>
                      <div className="border-t pt-3 flex justify-between">
                        <span className="font-semibold">Total</span>
                        <span className="font-semibold">{convertedAmount || "N/A"} {selectedTokenData.name}</span>
                      </div>
                    </div>
                    {convertedAmount && (
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center text-sm">
                          <AlertCircle className="w-4 h-4 text-blue-600 mr-2" />
                          <span className="text-blue-800">
                            Live rate: 1 {selectedTokenData.name} = {invoiceData?.currency}{(invoiceData?.amount / Number.parseFloat(convertedAmount)).toFixed(0)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  onClick={handlePayment}
                  disabled={!selectedChain || !selectedToken || isPaying || !convertedAmount}
                  className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 py-3"
                >
                  {isPaying ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing Payment...
                    </>
                  ) : (
                    <>
                      <Wallet className="w-4 h-4 mr-2" />
                      Pay {selectedTokenData && convertedAmount ? `${convertedAmount} ${selectedTokenData.name}` : ""}
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            Powered by <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium">EgyptFi</Link>
          </p>
        </div>
      </div>
    </div>
  );
}