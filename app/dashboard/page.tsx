"use client"

import { useMemo, useState } from "react"
import {
  Plus,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  ExternalLink,
  Settings,
  CreditCard,
  Code,
  Palette,
  Search,
  Filter,
  Download,
  MoreHorizontal,
  Wallet,
  ArrowDownToLine,
  AlertCircle,
  Loader2,
  TrendingUp,
  Lock,
  Calculator,
  Mail,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { WithdrawalHistory } from "./components/withdrawal-history"
import { Slider } from "@/components/ui/slider"
import { useToast } from "@/hooks/use-toast"

const initialMerchantData = {
  name: "TheBuidl Kitchen, Kaduna",
  logo: "☕",
  defaultCurrency: "NGN",
  testApiKey: "test_sk_1234567890abcdef1234567890abcdef",
  liveApiKey: "live_sk_abcdef1234567890abcdef1234567890",
  webhookUrl: "https://yoursite.com/webhook",
}

export default function DashboardPage() {
  const { toast } = useToast()
  const [copiedItem, setCopiedItem] = useState<string | null>(null)
  const [showTestKey, setShowTestKey] = useState(false)
  const [showLiveKey, setShowLiveKey] = useState(false)
  const [isCreatePaymentOpen, setIsCreatePaymentOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [availableBalance, setAvailableBalance] = useState(12.5) // Mock available USDC balance

  // Branding Tab
  const [businessName, setBusinessName] = useState(initialMerchantData.name)
  const [defaultCurrency, setDefaultCurrency] = useState(initialMerchantData.defaultCurrency)

  // Settings Tab
  const [email, setEmail] = useState("merchant@thebuidlkitcken.com")
  const [phone, setPhone] = useState("+234 801 234 5678")
  const [settlementWallet, setSettlementWallet] = useState("0x1234567890abcdef1234567890abcdef12345678")

  // Developer Tab - Webhook URL
  const [webhookUrl, setWebhookUrl] = useState(initialMerchantData.webhookUrl)

  // Create Payment Link Dialog
  const [createPaymentAmount, setCreatePaymentAmount] = useState("")
  const [createPaymentCurrency, setCreatePaymentCurrency] = useState("NGN")
  const [createPaymentDescription, setCreatePaymentDescription] = useState("")

  // Payments mock
  const payments = [
    {
      ref: "pay_abc123",
      amount: 5000,
      currency: "NGN",
      description: "Jollof Rice x2",
      tokenPaid: "3.2 USDC",
      chain: "Ethereum",
      status: "confirmed",
      txHash: "0x1234567890abcdef...",
      date: "2025-01-15 09:35:00",
      hostedUrl: "https://pay.nummus.xyz/pay_abc123",
    },
    {
      ref: "pay_def456",
      amount: 12500,
      currency: "NGN",
      description: "Catering Service",
      tokenPaid: "8.1 USDC",
      chain: "Polygon",
      status: "pending",
      txHash: "",
      date: "2025-01-15 10:15:00",
      hostedUrl: "https://pay.nummus.xyz/pay_def456",
    },
    {
      ref: "pay_ghi789",
      amount: 2500,
      currency: "NGN",
      description: "Family-sized Coke x1",
      tokenPaid: "0.0006 ETH",
      chain: "StarkNet",
      status: "confirmed",
      txHash: "0xabcdef1234567890...",
      date: "2025-01-14 16:22:00",
      hostedUrl: "https://pay.nummus.xyz/pay_ghi789",
    },
  ]

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedItem(id)
    setTimeout(() => setCopiedItem(null), 2000)
  }

  const filteredPayments = payments.filter((payment) => {
    const matchesSearch =
      payment.ref.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || payment.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "failed":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const handleWithdraw = async () => {
    setIsWithdrawing(true)
    setTimeout(() => {
      setIsWithdrawing(false)
      setIsWithdrawOpen(false)
      setWithdrawAmount("")
      setAvailableBalance((prev) => prev - Number.parseFloat(withdrawAmount || "0"))
    }, 3000)
  }

  // Yield Farming UX state
  const [yieldAmount, setYieldAmount] = useState<number>(100)
  const [yieldStrategy, setYieldStrategy] = useState<"conservative" | "balanced" | "aggressive">("balanced")
  const [isYieldWaitlistOpen, setIsYieldWaitlistOpen] = useState(false)
  const [yieldEmail, setYieldEmail] = useState("")

  const strategyApy = useMemo(() => {
    switch (yieldStrategy) {
      case "conservative":
        return 3.0
      case "balanced":
        return 5.2
      case "aggressive":
        return 8.0
      default:
        return 5.2
    }
  }, [yieldStrategy])

  const projectedMonthly = useMemo(() => (yieldAmount * strategyApy) / 100 / 12, [yieldAmount, strategyApy])
  const projectedYearly = useMemo(() => (yieldAmount * strategyApy) / 100, [yieldAmount, strategyApy])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">N</span>
              </div>
              <span className="text-xl font-bold text-gray-900">Nummus</span>
            </Link>
            <div className="hidden md:flex items-center space-x-2 text-sm text-gray-500">
              <span>/</span>
              <span>Dashboard</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center text-sm">
              {initialMerchantData.logo}
            </div>
            <span className="font-medium text-gray-900">{initialMerchantData.name}</span>
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Tabs defaultValue="payments" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="payments" className="flex items-center">
              <CreditCard className="w-4 h-4 mr-2" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="developer" className="flex items-center">
              <Code className="w-4 h-4 mr-2" />
              Developer
            </TabsTrigger>
            <TabsTrigger value="branding" className="flex items-center">
              <Palette className="w-4 h-4 mr-2" />
              Branding
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-6">
            {/* Stats Cards with Withdraw */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Available Balance</p>
                      <p className="text-2xl font-bold text-gray-900">{availableBalance.toFixed(1)} USDC</p>
                      <p className="text-xs text-gray-500 mt-1">Ready to withdraw</p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <Wallet className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                  <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
                    <DialogTrigger asChild>
                      <Button
                        className="w-full mt-4 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                        disabled={availableBalance <= 0}
                      >
                        <ArrowDownToLine className="w-4 h-4 mr-2" />
                        Withdraw USDC
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Withdraw USDC</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-center">
                            <AlertCircle className="w-5 h-5 text-blue-600 mr-2" />
                            <div>
                              <p className="font-medium text-blue-900">Available Balance</p>
                              <p className="text-sm text-blue-700">{availableBalance.toFixed(1)} USDC on StarkNet</p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="withdraw-amount">Amount to Withdraw</Label>
                          <div className="relative">
                            <Input
                              id="withdraw-amount"
                              placeholder="0.0"
                              type="number"
                              max={availableBalance}
                              value={withdrawAmount}
                              onChange={(e) => setWithdrawAmount(e.target.value)}
                              className="pr-16"
                            />
                            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500">
                              USDC
                            </span>
                          </div>
                          <div className="flex justify-between mt-2">
                            <button
                              type="button"
                              onClick={() => setWithdrawAmount((availableBalance * 0.5).toFixed(1))}
                              className="text-xs text-blue-600 hover:text-blue-700"
                            >
                              50%
                            </button>
                            <button
                              type="button"
                              onClick={() => setWithdrawAmount(availableBalance.toFixed(1))}
                              className="text-xs text-blue-600 hover:text-blue-700"
                            >
                              Max
                            </button>
                          </div>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="font-semibold text-gray-900 mb-2">Withdrawal Details</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Network</span>
                              <span className="font-medium">StarkNet</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Destination</span>
                              <span className="font-medium font-mono text-xs">0x1234...5678</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Gas Fees</span>
                              <span className="font-medium text-green-600">Sponsored</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Processing Time</span>
                              <span className="font-medium">~30 seconds</span>
                            </div>
                          </div>
                        </div>

                        <Button
                          onClick={handleWithdraw}
                          disabled={
                            isWithdrawing ||
                            !withdrawAmount ||
                            Number.parseFloat(withdrawAmount) <= 0 ||
                            Number.parseFloat(withdrawAmount) > availableBalance
                          }
                          className="w-full bg-gradient-to-r from-green-600 to-blue-600"
                        >
                          {isWithdrawing ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Processing Withdrawal...
                            </>
                          ) : (
                            <>
                              <ArrowDownToLine className="w-4 h-4 mr-2" />
                              Withdraw {withdrawAmount || "0"} USDC
                            </>
                          )}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Payments</p>
                      <p className="text-2xl font-bold text-gray-900">₦20,000</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <CreditCard className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">This Month</p>
                      <p className="text-2xl font-bold text-gray-900">₦15,000</p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <Check className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Success Rate</p>
                      <p className="text-2xl font-bold text-gray-900">95%</p>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <Badge className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Create Payment Button */}
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Payment Links</h2>
              <Dialog open={isCreatePaymentOpen} onOpenChange={setIsCreatePaymentOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-blue-600 to-purple-600">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Payment Link
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create Payment Link</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="amount">Amount</Label>
                      <Input
                        id="amount"
                        placeholder="5000"
                        type="number"
                        value={createPaymentAmount}
                        onChange={(e) => setCreatePaymentAmount(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="currency">Currency</Label>
                      <Select value={createPaymentCurrency} onValueChange={setCreatePaymentCurrency}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NGN">Nigerian Naira (NGN)</SelectItem>
                          <SelectItem value="USD">US Dollar (USD)</SelectItem>
                          <SelectItem value="EUR">Euro (EUR)</SelectItem>
                          <SelectItem value="GBP">British Pound (GBP)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        placeholder="Premium Coffee Blend x2"
                        value={createPaymentDescription}
                        onChange={(e) => setCreatePaymentDescription(e.target.value)}
                      />
                    </div>
                    <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600">Create Payment Link</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search payments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>

            {/* Yield Farming - Improved UX (Coming Soon) */}
            <Card className="border border-dashed border-purple-200 bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <CardTitle>Invest in Yield</CardTitle>
                      <p className="text-sm text-gray-600">Earn passive yield on idle USDC with on-chain strategies.</p>
                    </div>
                  </div>
                  <Badge className="bg-gray-200 text-gray-800">Coming Soon</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                {/* Strategy and amount */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="strategy">Strategy</Label>
                    <Select
                      value={yieldStrategy}
                      onValueChange={(v: "conservative" | "balanced" | "aggressive") => setYieldStrategy(v)}
                    >
                      <SelectTrigger id="strategy">
                        <SelectValue placeholder="Select strategy" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="conservative">Conservative • ~3.0% APY</SelectItem>
                        <SelectItem value="balanced">Balanced • ~5.2% APY</SelectItem>
                        <SelectItem value="aggressive">Aggressive • ~8.0% APY</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="allocate">Amount to allocate (USDC)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="allocate"
                        type="number"
                        min={0}
                        step="1"
                        value={yieldAmount.toString()}
                        onChange={(e) => setYieldAmount(Math.max(0, Number(e.target.value || 0)))}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setYieldAmount(Math.max(0, Math.floor(availableBalance)))}
                      >
                        Max
                      </Button>
                    </div>
                    <Slider
                      value={[yieldAmount]}
                      min={0}
                      max={Math.max(100, Math.ceil(availableBalance * 2))}
                      step={1}
                      onValueChange={(v) => setYieldAmount(v[0] ?? 0)}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Est. APY</p>
                    <p className="font-semibold text-gray-900">{strategyApy.toFixed(1)}%</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Projected Monthly</p>
                    <p className="font-semibold text-gray-900">{projectedMonthly.toFixed(2)} USDC</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Projected Yearly</p>
                    <p className="font-semibold text-gray-900">{projectedYearly.toFixed(2)} USDC</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Button disabled className="bg-gradient-to-r from-blue-600 to-purple-600 disabled:opacity-70">
                    <Lock className="w-4 h-4 mr-2" />
                    Invest (Coming Soon)
                  </Button>

                  <Dialog open={isYieldWaitlistOpen} onOpenChange={setIsYieldWaitlistOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <Mail className="w-4 h-4 mr-2" />
                        Join Waitlist
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Get notified when Yield Farming launches</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div className="grid gap-2">
                          <Label htmlFor="yield-email">Email</Label>
                          <Input
                            id="yield-email"
                            type="email"
                            placeholder="you@company.com"
                            value={yieldEmail}
                            onChange={(e) => setYieldEmail(e.target.value)}
                          />
                        </div>
                        <Button
                          className="w-full bg-gradient-to-r from-blue-600 to-purple-600"
                          onClick={() => {
                            if (!yieldEmail || !/^\S+@\S+\.\S+$/.test(yieldEmail)) {
                              toast({
                                title: "Enter a valid email",
                                description: "We’ll notify you when Yield Farming is live.",
                                variant: "destructive",
                              })
                              return
                            }
                            toast({
                              title: "You're on the list!",
                              description: "We’ll email you when Yield Farming launches.",
                            })
                            setYieldEmail("")
                            setIsYieldWaitlistOpen(false)
                          }}
                        >
                          Notify Me
                        </Button>
                        <p className="text-xs text-gray-500 text-center">
                          No spam. We’ll only message you about Yield Farming availability.
                        </p>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="mt-4 flex items-start gap-2 rounded-lg border border-purple-200 bg-purple-50 p-3">
                  <Calculator className="w-4 h-4 text-purple-600 mt-0.5" />
                  <p className="text-xs text-purple-900">
                    This calculator is an estimate and does not guarantee returns. Strategies will be transparent and
                    on-chain once launched.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Payments Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b bg-gray-50">
                      <tr>
                        <th className="text-left p-4 font-semibold text-gray-900">Payment Ref</th>
                        <th className="text-left p-4 font-semibold text-gray-900">Amount</th>
                        <th className="text-left p-4 font-semibold text-gray-900">Token Paid</th>
                        <th className="text-left p-4 font-semibold text-gray-900">Chain</th>
                        <th className="text-left p-4 font-semibold text-gray-900">Status</th>
                        <th className="text-left p-4 font-semibold text-gray-900">Date</th>
                        <th className="text-left p-4 font-semibold text-gray-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPayments.map((payment) => (
                        <tr key={payment.ref} className="border-b hover:bg-gray-50">
                          <td className="p-4">
                            <div>
                              <code className="text-sm bg-gray-100 px-2 py-1 rounded">{payment.ref}</code>
                              <p className="text-xs text-gray-500 mt-1">{payment.description}</p>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="font-medium">
                              {payment.currency} {payment.amount.toLocaleString()}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="font-medium">{payment.tokenPaid}</span>
                          </td>
                          <td className="p-4">
                            <span className="text-gray-600">{payment.chain}</span>
                          </td>
                          <td className="p-4">
                            <Badge className={getStatusColor(payment.status)}>{payment.status}</Badge>
                          </td>
                          <td className="p-4">
                            <span className="text-gray-600 text-sm">{payment.date}</span>
                          </td>
                          <td className="p-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => copyToClipboard(payment.hostedUrl, payment.ref)}>
                                  <Copy className="w-4 h-4 mr-2" />
                                  Copy Link
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={payment.hostedUrl} target="_blank">
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    View Payment
                                  </Link>
                                </DropdownMenuItem>
                                {payment.txHash && (
                                  <DropdownMenuItem
                                    onClick={() => copyToClipboard(payment.txHash, `tx-${payment.ref}`)}
                                  >
                                    <Copy className="w-4 h-4 mr-2" />
                                    Copy Tx Hash
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Withdrawal History */}
            <WithdrawalHistory />
          </TabsContent>

          {/* Developer Tab */}
          <TabsContent value="developer" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* API Keys */}
              <Card>
                <CardHeader>
                  <CardTitle>API Keys</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Test Key</Label>
                    <div className="flex items-center space-x-2 mt-1">
                      <Input
                        type={showTestKey ? "text" : "password"}
                        value={initialMerchantData.testApiKey}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button variant="outline" size="sm" onClick={() => setShowTestKey(!showTestKey)}>
                        {showTestKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(initialMerchantData.testApiKey, "test-key")}
                      >
                        {copiedItem === "test-key" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Live Key</Label>
                    <div className="flex items-center space-x-2 mt-1">
                      <Input
                        type={showLiveKey ? "text" : "password"}
                        value={initialMerchantData.liveApiKey}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button variant="outline" size="sm" onClick={() => setShowLiveKey(!showLiveKey)}>
                        {showLiveKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(initialMerchantData.liveApiKey, "live-key")}
                      >
                        {copiedItem === "live-key" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full bg-transparent">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Regenerate Keys
                  </Button>
                </CardContent>
              </Card>

              {/* Webhook Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle>Webhook Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="webhook-url">Webhook URL</Label>
                    <Input
                      id="webhook-url"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://yoursite.com/webhook"
                    />
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-2">Webhook Events</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• payment.confirmed - Payment verified on blockchain</li>
                      <li>• payment.settled - USDC settled to your wallet</li>
                      <li>• payment.failed - Payment failed or expired</li>
                    </ul>
                  </div>
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600">Update Webhook URL</Button>
                </CardContent>
              </Card>
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer" asChild>
                <Link href="/docs">
                  <CardContent className="p-6 text-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Code className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">API Documentation</h3>
                    <p className="text-sm text-gray-600">Complete API reference with examples</p>
                  </CardContent>
                </Link>
              </Card>

              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <RefreshCw className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">API Playground</h3>
                  <p className="text-sm text-gray-600">Test API endpoints interactively</p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Settings className="w-6 h-6 text-purple-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Sandbox Environment</h3>
                  <p className="text-sm text-gray-600">Test with fake transactions</p>
                </CardContent>
              </Card>
            </div>

            {/* Code Examples */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Start Examples</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="curl" className="w-full">
                  <TabsList>
                    <TabsTrigger value="curl">cURL</TabsTrigger>
                    <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                    <TabsTrigger value="python">Python</TabsTrigger>
                  </TabsList>
                  <TabsContent value="curl" className="mt-4">
                    <div className="bg-gray-900 rounded-lg p-4 relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 text-gray-400 hover:text-white"
                        onClick={() =>
                          copyToClipboard(
                            `curl -X POST https://api.nummus.xyz/api/payment/initiate \\
-H "Authorization: Bearer ${initialMerchantData.testApiKey}" \\
-H "Content-Type: application/json" \\
-d '{
"amount": 5000,
"currency": "NGN",
"description": "Premium Coffee Blend x2"
}'`,
                            "curl-example",
                          )
                        }
                      >
                        {copiedItem === "curl-example" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                      <pre className="text-green-400 text-sm overflow-x-auto">
                        {`curl -X POST https://api.nummus.xyz/api/payment/initiate \\
-H "Authorization: Bearer ${initialMerchantData.testApiKey}" \\
-H "Content-Type: application/json" \\
-d '{
"amount": 5000,
"currency": "NGN",
"description": "Premium Coffee Blend x2"
}'`}
                      </pre>
                    </div>
                  </TabsContent>
                  <TabsContent value="javascript" className="mt-4">
                    <div className="bg-gray-900 rounded-lg p-4 relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 text-gray-400 hover:text-white"
                        onClick={() =>
                          copyToClipboard(
                            `const response = await fetch('https://api.nummus.xyz/api/payment/initiate', {
method: 'POST',
headers: {
'Authorization': 'Bearer ${initialMerchantData.testApiKey}',
'Content-Type': 'application/json',
},
body: JSON.stringify({
amount: 5000,
currency: 'NGN',
description: 'Premium Coffee Blend x2'
})
});

const payment = await response.json();
console.log(payment.hosted_url);`,
                            "js-example",
                          )
                        }
                      >
                        {copiedItem === "js-example" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                      <pre className="text-green-400 text-sm overflow-x-auto">
                        {`const response = await fetch('https://api.nummus.xyz/api/payment/initiate', {
method: 'POST',
headers: {
'Authorization': 'Bearer ${initialMerchantData.testApiKey}',
'Content-Type': 'application/json',
},
body: JSON.stringify({
amount: 5000,
currency: 'NGN',
description: 'Premium Coffee Blend x2'
})
});

const payment = await response.json();
console.log(payment.hosted_url);`}
                      </pre>
                    </div>
                  </TabsContent>
                  <TabsContent value="python" className="mt-4">
                    <div className="bg-gray-900 rounded-lg p-4 relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 text-gray-400 hover:text-white"
                        onClick={() =>
                          copyToClipboard(
                            `import requests

response = requests.post(
'https://api.nummus.xyz/api/payment/initiate',
headers={
    'Authorization': 'Bearer ${initialMerchantData.testApiKey}',
    'Content-Type': 'application/json',
},
json={
    'amount': 5000,
    'currency': 'NGN',
    'description': 'Premium Coffee Blend x2'
}
)

payment = response.json()
print(payment['hosted_url'])`,
                            "python-example",
                          )
                        }
                      >
                        {copiedItem === "python-example" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                      <pre className="text-green-400 text-sm overflow-x-auto">
                        {`import requests

response = requests.post(
'https://api.nummus.xyz/api/payment/initiate',
headers={
    'Authorization': 'Bearer ${initialMerchantData.testApiKey}',
    'Content-Type': 'application/json',
},
json={
    'amount': 5000,
    'currency': 'NGN',
    'description': 'Premium Coffee Blend x2'
}
)

payment = response.json()
print(payment['hosted_url'])`}
                      </pre>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Branding Tab */}
          <TabsContent value="branding" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Brand Customization</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="business-name">Business Name</Label>
                    <Input id="business-name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="default-currency">Default Currency</Label>
                    <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NGN">Nigerian Naira (NGN)</SelectItem>
                        <SelectItem value="USD">US Dollar (USD)</SelectItem>
                        <SelectItem value="EUR">Euro (EUR)</SelectItem>
                        <SelectItem value="GBP">British Pound (GBP)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Business Logo</Label>
                  <div className="mt-2 flex items-center space-x-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center text-2xl">
                      {initialMerchantData.logo}
                    </div>
                    <div>
                      <Button variant="outline">Upload New Logo</Button>
                      <p className="text-sm text-gray-500 mt-1">Recommended: 200x200px, PNG or JPG</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Payment Page Preview</h3>
                  <div className="bg-white rounded-lg p-6 border max-w-md mx-auto">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center text-lg">
                        {initialMerchantData.logo}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{initialMerchantData.name}</h4>
                        <p className="text-sm text-gray-500">Payment Invoice</p>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">₦5,000</p>
                      <p className="text-sm text-gray-500">≈ 3.2 USDC</p>
                    </div>
                  </div>
                </div>

                <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600">Save Branding Settings</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Account Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Notification Preferences</h3>
                  <div className="space-y-3">
                    <label className="flex items-center space-x-3">
                      <input type="checkbox" defaultChecked className="rounded" />
                      <span className="text-sm">Email notifications for successful payments</span>
                    </label>
                    <label className="flex items-center space-x-3">
                      <input type="checkbox" defaultChecked className="rounded" />
                      <span className="text-sm">Email notifications for failed payments</span>
                    </label>
                    <label className="flex items-center space-x-3">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">Weekly payment summary reports</span>
                    </label>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Withdrawal Settings</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="settlement-wallet">Settlement Wallet Address (StarkNet)</Label>
                      <Input
                        id="settlement-wallet"
                        value={settlementWallet}
                        onChange={(e) => setSettlementWallet(e.target.value)}
                        className="font-mono text-sm"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        USDC withdrawals will be sent to this StarkNet wallet address
                      </p>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h4 className="font-semibold text-yellow-900 mb-2">Withdrawal Information</h4>
                      <ul className="text-sm text-yellow-800 space-y-1">
                        <li>• Minimum withdrawal: 1 USDC</li>
                        <li>• Gas fees are sponsored by Nummus</li>
                        <li>• Processing time: ~30 seconds on StarkNet</li>
                        <li>• Withdrawals are processed instantly</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600">Save Settings</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
