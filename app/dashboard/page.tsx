"use client";

import { useEffect, useMemo, useState, useRef } from "react";
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
  Upload,
  X,
  Save,
  Shield,
  Plane,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { WithdrawalHistory } from "./components/withdrawal-history";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { AuthManager } from "@/lib/auth-utils";
import {
  FormValidator,
  formatPhoneNumber,
  formatFileSize,
} from "@/lib/form-validation";
import DeveloperTab from "@/components/ApiKeysDisplay";
import AccountModal from "@/components/AccountModal";
import WalletModal from "@/components/WalletModal";
import { useAccount, useProvider } from "@starknet-react/core";
import { useRouter } from "next/navigation";

import { InvoiceService, Invoice } from "@/services/invoiceService";
import ContractMerchantService from "@/services/contractMerchantService";
import { PaymentModeIndicator } from "@/components/PaymentModeIndicator";
import { useWithdrawMerchantCalls } from "@/hooks/useWithdrawMerchantCalls"; // New import
import { usePaymaster } from "@/hooks/usePayMaster";
import { WithdrawalService } from "@/services/WithdrawService";
import {
  WithdrawalService as listwithdraw,
  Withdrawal,
} from "@/services/withdrawalService";
import Image from "next/image";
import YieldOptionsPage from "./components/yield-view";

const initialMerchantData = {
  name: "Coffee Shop Lagos",
  logo: "☕",
  defaultCurrency: "NGN",
  testApiKey: "test_sk_1234567890abcdef1234567890abcdef",
  liveApiKey: "live_sk_abcdef1234567890abcdef1234567890",
  webhookUrl: "https://yoursite.com/webhook",
};

export default function DashboardPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Existing state
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [showTestKey, setShowTestKey] = useState(false);
  const [showLiveKey, setShowLiveKey] = useState(false);
  const [isCreatePaymentOpen, setIsCreatePaymentOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [totalBalance, setTotalAmount] = useState<number>(0);
  const [monthBalance, setMonthAmount] = useState<number>(0);
  const [successRate, setsuccessRate] = useState<number>(0);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);

  const [payments, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  // Transaction state
  const [transactions, setTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);

  // Merchant data state
  const [businessName, setBusinessName] = useState(
    AuthManager.getMerchantInfo()?.businessName ||
      AuthManager.getMerchantInfo()?.businessName ||
      initialMerchantData.name
  );
  const [businessLogo, setBusinessLogo] = useState(
    AuthManager.getMerchantInfo()?.businessLogo || initialMerchantData.logo
  );
  const [defaultCurrency, setDefaultCurrency] = useState(
    initialMerchantData.defaultCurrency
  );
  const [email, setEmail] = useState(
    AuthManager.getMerchantInfo()?.businessEmail
  );
  const [phone, setPhone] = useState(AuthManager.getMerchantInfo()?.phone);
  const [settlementWallet, setSettlementWallet] = useState(
    AuthManager.getMerchantInfo()?.walletAddress
  );
  const [webhookUrl, setWebhookUrl] = useState(
    AuthManager.getMerchantInfo()?.webhookUrl || initialMerchantData.webhookUrl
  );
  const [merchantwallet, setmerchantwallet] = useState(
    AuthManager.getMerchantInfo()?.walletAddress || "0x0"
  );

  // Update states
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);

  // Track original values for comparison
  const [originalValues, setOriginalValues] = useState({
    businessName: "",
    phone: "",
    defaultCurrency: "",
    businessLogo: "",
  });

  // Other states
  const [createPaymentAmount, setCreatePaymentAmount] = useState("");
  const [createPaymentCurrency, setCreatePaymentCurrency] = useState("NGN");
  const [createPaymentDescription, setCreatePaymentDescription] = useState("");
  const [authMethod, setAuthMethod] = useState<"wallet" | "google" | null>(
    null
  );
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [yieldAmount, setYieldAmount] = useState<number>(100);
  const [yieldStrategy, setYieldStrategy] = useState<
    "conservative" | "balanced" | "aggressive"
  >("balanced");
  const [isYieldWaitlistOpen, setIsYieldWaitlistOpen] = useState(false);
  const [yieldEmail, setYieldEmail] = useState("");
  const [showKycModal, setShowKycModal] = useState(false);
  const [showKycTypeModal, setShowKycTypeModal] = useState(false);
  const [kycStatus, setKycStatus] = useState<string | null>(null);

  const { provider } = useProvider();

  useEffect(() => {
    async function fetchData() {
      const data = await listwithdraw.getWithdrawalstats();
      console.log(data);
      setTotalAmount(data.total_payments);
      setMonthAmount(data.current_month_payments);
      setsuccessRate(data.success_rate);

      // setWithdrawals(data)
      setLoading(false);
    }
    fetchData();
  }, []);

  useEffect(() => {
    async function fetchInvoices() {
      try {
        const data = await InvoiceService.getInvoices();
        console.log("Invoice Data", data);

        setInvoices(data);
      } catch (error) {
        console.error("Error loading invoices:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchInvoices();
  }, []);

  // Fetch transactions from backend
  // useEffect(() => {
  //   const fetchTransactions = async () => {
  //     try {
  //       const currentEnv = AuthManager.getCurrentEnvironment();
  //       const keys = AuthManager.getApiKeys(currentEnv);
  //       if (!keys || !keys.secretKey) {
  //         console.error("No API keys found");
  //         return;
  //       }

  //       const response = await fetch("/api/merchants/transactions", {
  //         headers: {
  //           "x-api-key": keys.secretKey,
  //           "x-environment": currentEnv,
  //         },
  //       });

  //       if (!response.ok) {
  //         throw new Error("Failed to fetch transactions");
  //       }

  //       const data = await response.json();
  //       console.log(data);
  //       setTransactions(data);
  //     } catch (error) {
  //       console.error("Error fetching transactions:", error);
  //     } finally {
  //       setLoadingTransactions(false);
  //     }
  //   };

  //   fetchTransactions();
  // }, []);

  // Fetch KYC status
  useEffect(() => {
    const fetchKycStatus = async () => {
      try {
        const response = await fetch("/api/merchants/kyc/submit", {
          method: "GET",
        });

        if (response.ok) {
          const data = await response.json();
          setKycStatus(data.kycStatus);
        }
      } catch (error) {
        console.error("Error fetching KYC status:", error);
      }
    };

    fetchKycStatus();
  }, []);

  const strategyApy = useMemo(() => {
    switch (yieldStrategy) {
      case "conservative":
        return 3.0;
      case "balanced":
        return 5.2;
      case "aggressive":
        return 8.0;
      default:
        return 5.2;
    }
  }, [yieldStrategy]);

  const projectedMonthly = useMemo(
    () => (yieldAmount * strategyApy) / 100 / 12,
    [yieldAmount, strategyApy]
  );
  const projectedYearly = useMemo(
    () => (yieldAmount * strategyApy) / 100,
    [yieldAmount, strategyApy]
  );

  // Check if branding data has changes
  const hasBrandingChanges = useMemo(() => {
    return (
      businessName !== originalValues.businessName ||
      defaultCurrency !== originalValues.defaultCurrency ||
      businessLogo !== originalValues.businessLogo ||
      pendingLogoFile !== null
    );
  }, [
    businessName,
    defaultCurrency,
    businessLogo,
    originalValues,
    pendingLogoFile,
  ]);

  // Check if settings data has changes
  const hasSettingsChanges = useMemo(() => {
    return phone !== originalValues.phone;
  }, [phone, originalValues.phone]);

  // Utility to convert u256 to number (assuming 6 decimals)
  const bigintToNumber = (value?: bigint, decimals = 6): number => {
    if (!value) return 0;
    return Number(value) / 10 ** decimals;
  };

  // Authentication check commented out for development
  useEffect(() => {
    const checkAuth = async () => {
      setIsCheckingAuth(true);

      try {
        const isAuthenticated = await AuthManager.isAuthenticated();
        console.log("AuthManager.isAuthenticated:", isAuthenticated);

        if (!isAuthenticated) {
          const merchant = AuthManager.getMerchantInfo();
          const currentEnv = AuthManager.getCurrentEnvironment();
          const keys = AuthManager.getApiKeys(currentEnv);
          console.log(merchant);
          console.log(currentEnv);
          console.log(keys);

          if (merchant && keys) {
            console.log(
              "Stored auth data exists but verification failed - token may be expired"
            );
            setIsSessionExpired(true);
          } else {
            console.log("No stored auth data - redirecting to login");
            router.push("/");
          }
          setIsCheckingAuth(false);
          return;
        }

        const merchant = AuthManager.getMerchantInfo();
        console.log(merchant);
        if (!merchant) {
          toast({
            title: "Authentication required",
            description: "Please log in to access your dashboard.",
            variant: "destructive",
          });
          router.push("/login");
          return;
        }

        // Set original values for change tracking
        setOriginalValues({
          businessName: merchant.businessName || initialMerchantData.name,
          phone: merchant.phone || "",
          defaultCurrency:
            merchant.defaultCurrency || initialMerchantData.defaultCurrency,
          businessLogo: merchant.businessLogo || initialMerchantData.logo,
        });

        // Check wallet connection
        if (!isConnected || !address) {
          setShowWalletModal(true);
          setIsCheckingAuth(false);
          return;
        }

        await refetchMerchantInfo(); // Fetch balance on load

        setmerchantwallet(merchant.walletAddress.toLowerCase());

        setmerchantwallet(merchant.walletAddress.toLowerCase());

        // Verify wallet matches merchant
        if (merchant.walletAddress.toLowerCase() !== address.toLowerCase()) {
          toast({
            title: "Wallet mismatch",
            description:
              "Connected wallet does not match registered merchant wallet. Please reconnect the correct wallet.",
            variant: "destructive",
          });
          setShowWalletModal(true);
          setIsCheckingAuth(false);
          return;
        }

        setIsCheckingAuth(false);
      } catch (error) {
        console.error("Authentication check error:", error);
        setIsCheckingAuth(false);
        toast({
          title: "Authentication error",
          description:
            "There was an error checking your authentication. Please try refreshing the page.",
          variant: "destructive",
        });
      }
    };

    checkAuth();
  }, [router, isConnected, address]);

  // Set default merchant data for development (bypassing auth)
  useEffect(() => {
    setOriginalValues({
      businessName: initialMerchantData.name,
      phone: "",
      defaultCurrency: initialMerchantData.defaultCurrency,
      businessLogo: initialMerchantData.logo,
    });

    // Set default merchant wallet for development
    setmerchantwallet("0x1234567890abcdef1234567890abcdef12345678");

    // Skip wallet connection check for development
    setIsCheckingAuth(false);
  }, []);

  // Logo upload handler
  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file using our validator
    const validation = FormValidator.validateImageFile(file);
    if (!validation.isValid) {
      toast({
        title: "Invalid file",
        description: validation.errors.join(", "),
        variant: "destructive",
      });
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setLogoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    setPendingLogoFile(file);
  };

  // Remove uploaded logo
  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setPendingLogoFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Refetch merchant info (including balance)
  const refetchMerchantInfo = async () => {
    try {
      const contractService = new ContractMerchantService(provider);
      const contractMerchant = await contractService.getMerchant(
        merchantwallet
      );
      console.log("contractMerchant", contractMerchant);

      const balance = bigintToNumber(contractMerchant?.merchant?.usdc_balance);
      setAvailableBalance(balance);
      console.log("Fetched balance:", balance);
    } catch (error) {
      console.error("Error fetching merchant info:", error);
      toast({
        title: "Error fetching balance",
        description: "Failed to load available balance. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Upload logo to server
  const uploadLogo = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("logo", file);

    // Commented out AuthManager for development - using regular fetch
    // const response = await AuthManager.makeAuthenticatedRequest(
    //   "/api/merchants/upload-logo",
    //   {
    //     method: "POST",
    //     body: formData, // Don't set Content-Type header for FormData
    //   }
    // );

    const response = await fetch("/api/merchants/upload-logo", {
      method: "POST",
      body: formData, // Don't set Content-Type header for FormData
    });

    if (!response.ok) {
      throw new Error("Failed to upload logo");
    }

    const result = await response.json();
    return result.logoUrl;
  };

  // Update branding settings
  const handleUpdateBranding = async () => {
    // Validate form data before submitting
    const validation = FormValidator.validateBrandingData({
      businessName,
      currency: defaultCurrency,
      logoFile: pendingLogoFile || undefined,
    });

    if (!validation.isValid) {
      toast({
        title: "Validation Error",
        description: validation.errors.join(", "),
        variant: "destructive",
      });
      return;
    }

    setIsUpdatingProfile(true);
    try {
      let logoUrl = businessLogo;

      // Upload new logo if one was selected
      if (pendingLogoFile) {
        setIsUploadingLogo(true);
        logoUrl = await uploadLogo(pendingLogoFile);
        setIsUploadingLogo(false);
      }

      const updates = {
        business_name: businessName.trim(),
        business_logo: logoUrl,
        local_currency: defaultCurrency,
      };

      // Commented out AuthManager for development - using regular fetch
      const response = await AuthManager.makeAuthenticatedRequest(
        "/api/merchants/profile",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        }
      );

      // const response = await fetch("/api/merchants/profile", {
      //   method: "PUT",
      //   headers: {
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify(updates),
      // });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update profile");
      }

      const result = await response.json();

      // Update local state and storage
      setBusinessLogo(logoUrl);
      setLogoPreview(null);
      setPendingLogoFile(null);

      // Update original values
      setOriginalValues((prev) => ({
        ...prev,
        businessName: businessName.trim(),
        defaultCurrency,
        businessLogo: logoUrl,
      }));

      // Update AuthManager storage
      const merchantInfo = AuthManager.getMerchantInfo();
      if (merchantInfo) {
        AuthManager.setMerchantInfo({
          ...merchantInfo,
          businessName: businessName.trim(),
          businessLogo: logoUrl,
          defaultCurrency,
        });
      }

      toast({
        title: "Branding updated",
        description: "Your brand settings have been saved successfully.",
      });
    } catch (error) {
      console.error("Error updating branding:", error);
      toast({
        title: "Update failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update branding settings",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingProfile(false);
      setIsUploadingLogo(false);
    }
  };

  // Update account settings
  const handleUpdateSettings = async () => {
    // Validate form data before submitting
    const validation = FormValidator.validateSettingsData({
      phone: phone || "",
    });

    if (!validation.isValid) {
      toast({
        title: "Validation Error",
        description: validation.errors.join(", "),
        variant: "destructive",
      });
      return;
    }

    setIsUpdatingSettings(true);
    try {
      const updates = {
        phone: phone ? formatPhoneNumber(phone) : null,
      };

      // Commented out AuthManager for development - using regular fetch
      // const response = await AuthManager.makeAuthenticatedRequest(
      //   "/api/merchants/profile",
      //   {
      //     method: "PUT",
      //     headers: {
      //       "Content-Type": "application/json",
      //     },
      //     body: JSON.stringify(updates),
      //   }
      // );

      const response = await fetch("/api/merchants/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update settings");
      }

      const formattedPhone = phone ? formatPhoneNumber(phone) : "";
      setPhone(formattedPhone);

      // Update original values
      setOriginalValues((prev) => ({
        ...prev,
        phone: formattedPhone,
      }));

      // Update AuthManager storage
      const merchantInfo = AuthManager.getMerchantInfo();
      if (merchantInfo) {
        AuthManager.setMerchantInfo({
          ...merchantInfo,
          phone: formattedPhone,
        });
      }

      toast({
        title: "Settings updated",
        description: "Your account settings have been saved successfully.",
      });
    } catch (error) {
      console.error("Error updating settings:", error);
      toast({
        title: "Update failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update account settings",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  // Prepare withdrawal calls (enabled only when dialog is open)
  const { calls: withdrawCalls } = useWithdrawMerchantCalls({
    amount: withdrawAmount,
    enabled:
      isWithdrawOpen && !!withdrawAmount && parseFloat(withdrawAmount) > 0,
  });

  // Use paymaster for transaction (sponsored or free mode)
  const {
    executeTransaction: executeWithdraw,
    isLoading: isWithdrawTxLoading,
    paymentMode,
  } = usePaymaster({
    calls: withdrawCalls,
    enabled: !!withdrawCalls,
    onSuccess: (transactionHash: string) => {
      toast({
        title: "Withdrawal initiated",
        description: `Transaction hash: ${transactionHash}. Funds will arrive shortly.`,
      });
      refetchMerchantInfo(); // Refetch balance after success
    },
    onError: (error: any) => {
      toast({
        title: "Withdrawal error",
        description: error.message || "Transaction failed. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle withdrawal
  const handleWithdraw = async () => {
    const amountNum = parseFloat(withdrawAmount);
    if (amountNum <= 0 || amountNum > availableBalance) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount within your balance.",
        variant: "destructive",
      });
      return;
    }

    if (!withdrawCalls) {
      toast({
        title: "Transaction not ready",
        description: "Please try again.",
        variant: "destructive",
      });
      return;
    }

    setIsWithdrawing(true);
    try {
      // Execute withdrawal and record in database
      const withdrawal = await WithdrawalService.createWithdrawal({
        merchantWallet: merchantwallet,
        amount: withdrawAmount,
        executeWithdraw,
        calls: withdrawCalls,
        paymentMode,
      });

      // Update balance optimistically
      setAvailableBalance((prev) => prev - amountNum);

      toast({
        title: "Withdrawal successful",
        description: `${withdrawAmount} USDC withdrawn to ${withdrawal.to_address}. Transaction hash: ${withdrawal.txHash}`,
      });
    } catch (error) {
      console.error("Withdrawal failed:", error);
      toast({
        title: "Withdrawal failed",
        description:
          error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsWithdrawing(false);
      setIsWithdrawOpen(false);
      setWithdrawAmount("");
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // if (isSessionExpired) {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center bg-background">
  //       <div className="text-center">
  //         <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
  //         <h2 className="text-2xl font-bold text-foreground mb-2">
  //           Session Expired
  //         </h2>
  //         <p className="text-muted-foreground mb-6">
  //           Your session has expired or is invalid. Please log in again to
  //           continue.
  //         </p>
  //         <Button
  //           onClick={() => {
  //             AuthManager.clearAuth();
  //             router.push("/login");
  //           }}
  //           className="bg-gradient-to-r from-blue-600 to-purple-600"
  //         >
  //           Log In Again
  //         </Button>
  //       </div>
  //     </div>
  //   );
  // }

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedItem(id);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  // Export payments to CSV
  const exportToCSV = () => {
    if (payments.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no payments to export.",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Payment Ref",
      "Amount",
      "Token Paid",
      "Chain",
      "Status",
      "Date",
    ];
    const csvContent = [
      headers.join(","),
      ...payments.map((payment) =>
        [
          payment.payment_ref,
          `${payment.local_currency} ${payment.amount}`,
          payment.tokenPaid,
          payment.chain,
          payment.status,
          payment.created_at,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `payment_history_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredPayments = payments.filter((payment) => {
    const matchesSearch =
      payment.ref.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || payment.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // const handleWithdraw = async () => {
  //   setIsWithdrawing(true);
  //   try {
  //     await AuthManager.makeAuthenticatedRequest("/api/withdraw", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ amount: withdrawAmount }),
  //     });
  //     setAvailableBalance(
  //       (prev) => prev - Number.parseFloat(withdrawAmount || "0")
  //     );
  //     toast({
  //       title: "Withdrawal successful",
  //       description: `${withdrawAmount} USDC withdrawn to your wallet.`,
  //     });
  //   } catch (error) {
  //     toast({
  //       title: "Withdrawal failed",
  //       description:
  //         error instanceof Error ? error.message : "An error occurred",
  //       variant: "destructive",
  //     });
  //   } finally {
  //     setIsWithdrawing(false);
  //     setIsWithdrawOpen(false);
  //     setWithdrawAmount("");
  //   }
  // };

  const handleWalletModalClose = () => {
    setShowWalletModal(false);
    if (!isConnected) {
      toast({
        title: "Wallet connection required",
        description: "Please connect your wallet to continue.",
        variant: "destructive",
      });
      // router.push("/login");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* <div className="flex-shrink-0"> */}
            <Link href="/" className="flex items-center">
              <Image
                src="/egyptfi_logo-03.png"
                alt="EGYPTFI"
                width={840}
                height={280}
                className="h-56 w-auto dark:hidden"
              />
              <Image
                src="/egyptfi_white-03.png"
                alt="EGYPTFI"
                width={840}
                height={280}
                className="h-56 w-auto hidden dark:block"
              />
            </Link>
            {/* </div> */}
            <div className="hidden md:flex items-center space-x-2 text-sm text-muted-foreground">
              <span>/</span>
              <span>Dashboard</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center text-sm">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Business logo"
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : typeof businessLogo === "string" &&
                businessLogo.startsWith("/") ? (
                <img
                  src={businessLogo}
                  alt="Business logo"
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                businessLogo
              )}
            </div>

            <span className="font-medium text-foreground">{businessName}</span>
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
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* KYC Completion CTA - Only show if not verified */}
        {kycStatus !== "verified" && (
          <div className="mb-6">
            <div className="bg-gradient-to-r from-primary to-yellow-600 rounded-lg p-6 text-center">
              <h2 className="text-2xl font-bold text-primary-foreground mb-2">
                Complete Your KYC
              </h2>
              <p className="text-primary-foreground/90 mb-4">
                Verify your identity to unlock full access to all EgyptFi
                features and increase your transaction limits.
              </p>
              <Button
                onClick={() => setShowKycModal(true)}
                className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-semibold px-8 py-3"
              >
                Start KYC Verification
              </Button>
            </div>
          </div>
        )}

        <Tabs defaultValue="payments" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="payments" className="flex items-center">
              <CreditCard className="w-4 h-4 mr-2" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="yields" className="flex items-center">
              <Plane className="w-4 h-4 mr-2" />
              Yields
            </TabsTrigger>
            <TabsTrigger value="developer" className="flex items-center">
              <Code className="w-4 h-4 mr-2" />
              Developer
            </TabsTrigger>
            <TabsTrigger value="branding" className="flex items-center">
              <Palette className="w-4 h-4 mr-2" />
              Branding
              {hasBrandingChanges && (
                <div className="w-2 h-2 bg-orange-500 rounded-full ml-1" />
              )}
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center">
              <Settings className="w-4 h-4 mr-2" />
              Settings
              {hasSettingsChanges && (
                <div className="w-2 h-2 bg-orange-500 rounded-full ml-1" />
              )}
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
                      <p className="text-sm font-medium text-muted-foreground">
                        Available Balance
                      </p>
                      <p className="text-2xl font-bold text-foreground">
                        {availableBalance.toFixed(1)} USDC
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ready to withdraw
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <Wallet className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                  <Dialog
                    open={isWithdrawOpen}
                    onOpenChange={setIsWithdrawOpen}
                  >
                    <DialogTrigger asChild>
                      <Button
                        className="w-full mt-4 bg-background text-foreground border-2"
                        style={{ borderColor: "#d4af37" }}
                        // disabled={availableBalance <= 0}
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
                              <p className="font-medium text-blue-900">
                                Available Balance
                              </p>
                              <p className="text-sm text-blue-700">
                                {availableBalance.toFixed(1)} USDC on StarkNet
                              </p>
                            </div>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="withdraw-amount">
                            Amount to Withdraw
                          </Label>
                          <div className="relative">
                            <Input
                              id="withdraw-amount"
                              placeholder="0.0"
                              type="number"
                              max={availableBalance}
                              value={withdrawAmount}
                              onChange={(e) =>
                                setWithdrawAmount(e.target.value)
                              }
                              className="pr-16"
                            />
                            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500">
                              USDC
                            </span>
                          </div>
                          <div className="flex justify-between mt-2">
                            <button
                              type="button"
                              onClick={() =>
                                setWithdrawAmount(
                                  (availableBalance * 0.5).toFixed(1)
                                )
                              }
                              className="text-xs text-blue-600 hover:text-blue-700"
                            >
                              50%
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setWithdrawAmount(availableBalance.toFixed(1))
                              }
                              className="text-xs text-blue-600 hover:text-blue-700"
                            >
                              Max
                            </button>
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="font-semibold text-gray-900 mb-2">
                            Withdrawal Details
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Network</span>
                              <span className="font-medium">StarkNet</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Destination</span>
                              <span className="font-medium font-mono text-xs">
                                {merchantwallet.slice(0, 6)}...
                                {merchantwallet.slice(-4)}
                              </span>
                            </div>
                            {/* <div className="flex justify-between">
                              <span className="text-gray-600">Gas Fees</span>
                              <span className="font-medium text-green-600">
                                Sponsored
                              </span>
                            </div> */}
                            <div className="flex justify-between">
                              <span className="text-gray-600">
                                Processing Time
                              </span>
                              <span className="font-medium">~30 seconds</span>
                            </div>
                          </div>
                        </div>
                        {merchantwallet && (
                          <PaymentModeIndicator showDetails={false} />
                        )}
                        <Button
                          onClick={handleWithdraw}
                          disabled={
                            isWithdrawing ||
                            isWithdrawTxLoading ||
                            !withdrawAmount
                          }
                          className="w-full bg-background text-foreground border-2"
                          style={{ borderColor: "#d4af37" }}
                        >
                          {isWithdrawing || isWithdrawTxLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Withdrawing...
                            </>
                          ) : (
                            "Withdraw Now"
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
                      <p className="text-sm font-medium text-muted-foreground">
                        Total Payments
                      </p>
                      <p className="text-2xl font-bold text-foreground">
                        {/* ₦{totalBalance} */}
                        {totalBalance}
                      </p>
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
                      <p className="text-sm font-medium text-muted-foreground">
                        This Month
                      </p>
                      <p className="text-2xl font-bold text-foreground">
                        {monthBalance}
                        {/* ₦{monthBalance} */}
                      </p>
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
                      <p className="text-sm font-medium text-muted-foreground">
                        Success Rate
                      </p>
                      <p className="text-2xl font-bold text-foreground">
                        {successRate}%
                      </p>
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
              <h2 className="text-2xl font-bold text-foreground">
                Payment Links
              </h2>
              <Dialog
                open={isCreatePaymentOpen}
                onOpenChange={setIsCreatePaymentOpen}
              >
                <DialogTrigger asChild>
                  <Button
                    className="bg-background text-foreground border-2"
                    style={{ borderColor: "#d4af37" }}
                  >
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
                      <Select
                        value={createPaymentCurrency}
                        onValueChange={setCreatePaymentCurrency}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NGN">
                            Nigerian Naira (NGN)
                          </SelectItem>
                          <SelectItem value="USD">US Dollar (USD)</SelectItem>
                          <SelectItem value="EUR">Euro (EUR)</SelectItem>
                          <SelectItem value="GBP">
                            British Pound (GBP)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        placeholder="Premium Coffee Blend x2"
                        value={createPaymentDescription}
                        onChange={(e) =>
                          setCreatePaymentDescription(e.target.value)
                        }
                      />
                    </div>
                    <Button
                      className="w-full bg-background text-foreground border-2"
                      style={{ borderColor: "#d4af37" }}
                    >
                      Create Payment Link
                    </Button>
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
              <Button
                variant="outline"
                className="bg-background text-foreground border-2"
                style={{ borderColor: "#d4af37" }}
                onClick={exportToCSV}
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>

            {/* Payments Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ArrowDownToLine className="w-5 h-5 mr-2 text-green-600" />
                  Payment History
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b bg-muted/50">
                      <tr>
                        <th className="text-left p-4 font-semibold text-foreground">
                          Payment Ref
                        </th>
                        <th className="text-left p-4 font-semibold text-foreground">
                          Amount
                        </th>
                        <th className="text-left p-4 font-semibold text-foreground">
                          Token Paid
                        </th>
                        <th className="text-left p-4 font-semibold text-foreground">
                          Chain
                        </th>
                        <th className="text-left p-4 font-semibold text-foreground">
                          Status
                        </th>
                        <th className="text-left p-4 font-semibold text-foreground">
                          Date
                        </th>
                        <th className="text-left p-4 font-semibold text-foreground">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPayments.length > 0 ? (
                        filteredPayments.map((payment) => (
                          <tr
                            key={payment.payment_ref}
                            className="border-b hover:bg-muted/50"
                          >
                            <td className="p-4">
                              <div>
                                <code className="text-sm bg-muted px-2 py-1 rounded">
                                  {payment.payment_ref}
                                </code>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {payment.description}
                                </p>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="font-medium text-foreground">
                                {payment.local_currency}{" "}
                                {payment.amount.toLocaleString()}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="font-medium text-foreground">
                                {payment.tokenPaid}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="text-muted-foreground">
                                {payment.chain}
                              </span>
                            </td>
                            <td className="p-4">
                              <Badge className={getStatusColor(payment.status)}>
                                {payment.status}
                              </Badge>
                            </td>
                            <td className="p-4">
                              <span className="text-muted-foreground text-sm">
                                {payment.created_at}
                              </span>
                            </td>
                            <td className="p-4">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() =>
                                      copyToClipboard(
                                        payment.secondary_endpoint,
                                        payment.payment_ref
                                      )
                                    }
                                  >
                                    <Copy className="w-4 h-4 mr-2" />
                                    Copy Link
                                  </DropdownMenuItem>
                                  <DropdownMenuItem asChild>
                                    <Link
                                      href={payment.secondary_endpoint}
                                      target="_blank"
                                    >
                                      <ExternalLink className="w-4 h-4 mr-2" />
                                      View Payment
                                    </Link>
                                  </DropdownMenuItem>
                                  {payment.tx_hash && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        copyToClipboard(
                                          payment.tx_hash,
                                          `tx-${payment.payment_ref}`
                                        )
                                      }
                                    >
                                      <Copy className="w-4 h-4 mr-2" />
                                      Copy Tx Hash
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={7}
                            className="p-6 text-center text-muted-foreground"
                          >
                            <ArrowDownToLine className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                            <p className="text-muted-foreground">
                              No Payment yet
                            </p>
                            <p className="text-sm text-muted-foreground/70">
                              Your Payment history will appear here
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Withdrawal History */}
            <WithdrawalHistory />
          </TabsContent>

          {/* YIELD OPTIONS*/}
          <TabsContent value="yields" className="space-y-6">
            {/* Yield Farming - Improved UX (Coming Soon)
            <Card className="border border-dashed border-purple-200 bg-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <CardTitle>Invest in Yield</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Earn passive yield on idle USDC with on-chain
                        strategies.
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-muted text-muted-foreground">
                    Coming Soon
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="strategy">Strategy</Label>
                    <Select
                      value={yieldStrategy}
                      onValueChange={(
                        v: "conservative" | "balanced" | "aggressive"
                      ) => setYieldStrategy(v)}
                    >
                      <SelectTrigger id="strategy">
                        <SelectValue placeholder="Select strategy" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="conservative">
                          Conservative • ~3.0% APY
                        </SelectItem>
                        <SelectItem value="balanced">
                          Balanced • ~5.2% APY
                        </SelectItem>
                        <SelectItem value="aggressive">
                          Aggressive • ~8.0% APY
                        </SelectItem>
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
                        onChange={(e) =>
                          setYieldAmount(
                            Math.max(0, Number(e.target.value || 0))
                          )
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setYieldAmount(
                            Math.max(0, Math.floor(availableBalance))
                          )
                        }
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
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Est. APY</p>
                    <p className="font-semibold text-foreground">
                      {strategyApy.toFixed(1)}%
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">
                      Projected Monthly
                    </p>
                    <p className="font-semibold text-foreground">
                      {projectedMonthly.toFixed(2)} USDC
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">
                      Projected Yearly
                    </p>
                    <p className="font-semibold text-foreground">
                      {projectedYearly.toFixed(2)} USDC
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Button
                    disabled
                    style={{ backgroundColor: "#d4af37" }}
                    className="disabled:opacity-70"
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Invest (Coming Soon)
                  </Button>
                  <Dialog
                    open={isYieldWaitlistOpen}
                    onOpenChange={setIsYieldWaitlistOpen}
                  >
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <Mail className="w-4 h-4 mr-2" />
                        Join Waitlist
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>
                          Get notified when Yield Farming launches
                        </DialogTitle>
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
                            if (
                              !yieldEmail ||
                              !/^\S+@\S+\.\S+$/.test(yieldEmail)
                            ) {
                              toast({
                                title: "Enter a valid email",
                                description:
                                  "We'll notify you when Yield Farming is live.",
                                variant: "destructive",
                              });
                              return;
                            }
                            toast({
                              title: "You're on the list!",
                              description:
                                "We'll email you when Yield Farming launches.",
                            });
                            setYieldEmail("");
                            setIsYieldWaitlistOpen(false);
                          }}
                        >
                          Notify Me
                        </Button>
                        <p className="text-xs text-gray-500 text-center">
                          No spam. We'll only message you about Yield Farming
                          availability.
                        </p>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-purple-200 bg-purple-50 p-3">
                  <Calculator className="w-4 h-4 text-purple-600 mt-0.5" />
                  <p className="text-xs text-purple-900">
                    This calculator is an estimate and does not guarantee
                    returns. Strategies will be transparent and on-chain once
                    launched.
                  </p>
                </div>
              </CardContent>
            </Card> */}

            <YieldOptionsPage />
          </TabsContent>

          {/* Developer Tab */}
          <TabsContent value="developer" className="space-y-6">
            <DeveloperTab webhook={webhookUrl} />
          </TabsContent>

          {/* Branding Tab */}
          <TabsContent value="branding" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Brand Customization</CardTitle>
                  {hasBrandingChanges && (
                    <Badge
                      variant="outline"
                      className="bg-orange-50 text-orange-700 border-orange-200"
                    >
                      Unsaved Changes
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="business-name">Business Name</Label>
                    <Input
                      id="business-name"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="Enter your business name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="default-currency">Default Currency</Label>
                    <Select
                      value={defaultCurrency}
                      onValueChange={setDefaultCurrency}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NGN">
                          Nigerian Naira (NGN)
                        </SelectItem>
                        <SelectItem value="USD">US Dollar (USD)</SelectItem>
                        <SelectItem value="EUR">Euro (EUR)</SelectItem>
                        <SelectItem value="GBP">British Pound (GBP)</SelectItem>
                        <SelectItem value="GHS">Ghanaian Cedi (GHS)</SelectItem>
                        <SelectItem value="KES">
                          Kenyan Shilling (KES)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Business Logo</Label>
                  <div className="mt-2">
                    <div className="flex items-center space-x-4 mb-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center text-2xl overflow-hidden">
                        {logoPreview ? (
                          <img
                            src={logoPreview}
                            alt="Business logo"
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : typeof businessLogo === "string" &&
                          businessLogo.startsWith("/") ? (
                          <img
                            src={businessLogo}
                            alt="Business logo"
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          businessLogo
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploadingLogo}
                            className="bg-background text-foreground border-2"
                            style={{ borderColor: "#d4af37" }}
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            {logoPreview ? "Change Logo" : "Upload Logo"}
                          </Button>
                          {logoPreview && (
                            <Button
                              variant="outline"
                              onClick={handleRemoveLogo}
                              disabled={isUploadingLogo}
                              className="bg-background text-foreground border-2"
                              style={{ borderColor: "#d4af37" }}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          Recommended: 200x200px, PNG or JPG, max 5MB
                        </p>
                        {pendingLogoFile && (
                          <p className="text-sm text-blue-600 mt-1">
                            Selected: {pendingLogoFile.name} (
                            {formatFileSize(pendingLogoFile.size)})
                          </p>
                        )}
                      </div>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-6">
                  <h3 className="font-semibold text-foreground mb-4">
                    Payment Page Preview
                  </h3>
                  <div className="bg-card rounded-lg p-6 border max-w-md mx-auto">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center text-lg overflow-hidden">
                        {logoPreview ? (
                          <img
                            src={logoPreview}
                            alt="Business logo"
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : typeof businessLogo === "string" &&
                          businessLogo.startsWith("/") ? (
                          <img
                            src={businessLogo}
                            alt="Business logo"
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          businessLogo
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground">
                          {businessName}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Payment Invoice
                        </p>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">
                        {defaultCurrency === "NGN"
                          ? "₦"
                          : defaultCurrency === "USD"
                          ? "$"
                          : defaultCurrency === "EUR"
                          ? "€"
                          : defaultCurrency === "GBP"
                          ? "£"
                          : defaultCurrency === "GHS"
                          ? "GH₵"
                          : defaultCurrency === "KES"
                          ? "KSh"
                          : ""}
                        5,000
                      </p>
                      <p className="text-sm text-muted-foreground">
                        ≈ 3.2 USDC
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleUpdateBranding}
                    disabled={
                      !hasBrandingChanges ||
                      isUpdatingProfile ||
                      isUploadingLogo
                    }
                    className="flex-1 bg-background text-foreground border-2"
                    style={{ borderColor: "#d4af37" }}
                  >
                    {isUpdatingProfile ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {isUploadingLogo ? "Uploading Logo..." : "Saving..."}
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Branding Settings
                      </>
                    )}
                  </Button>
                  {hasBrandingChanges && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setBusinessName(originalValues.businessName);
                        setDefaultCurrency(originalValues.defaultCurrency);
                        setBusinessLogo(originalValues.businessLogo);
                        handleRemoveLogo();
                      }}
                      disabled={isUpdatingProfile}
                      className="bg-background text-foreground border-2"
                      style={{ borderColor: "#d4af37" }}
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Account Settings</CardTitle>
                  {hasSettingsChanges && (
                    <Badge
                      variant="outline"
                      className="bg-orange-50 text-orange-700 border-orange-200"
                    >
                      Unsaved Changes
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email || ""}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Email cannot be changed from this dashboard
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone || ""}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+234 XXX XXX XXXX"
                    />
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-semibold text-foreground mb-4">
                    Notification Preferences
                  </h3>
                  <div className="space-y-3">
                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="rounded"
                      />
                      <span className="text-sm text-foreground">
                        Email notifications for successful payments
                      </span>
                    </label>
                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="rounded"
                      />
                      <span className="text-sm text-foreground">
                        Email notifications for failed payments
                      </span>
                    </label>
                    <label className="flex items-center space-x-3">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm text-foreground">
                        Weekly payment summary reports
                      </span>
                    </label>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-semibold text-foreground mb-4">
                    Withdrawal Settings
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="settlement-wallet">
                        Settlement Wallet Address (StarkNet)
                      </Label>
                      <Input
                        id="settlement-wallet"
                        value={settlementWallet || ""}
                        onChange={(e) => setSettlementWallet(e.target.value)}
                        className="font-mono text-sm"
                        disabled
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        USDC withdrawals will be sent to this StarkNet wallet
                        address
                      </p>
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h4 className="font-semibold text-yellow-900 mb-2">
                        Withdrawal Information
                      </h4>
                      <ul className="text-sm text-yellow-800 space-y-1">
                        <li>• Minimum withdrawal: 1 USDC</li>
                        <li>• Gas fees are sponsored by EgyptFi</li>
                        <li>• Processing time: ~30 seconds on StarkNet</li>
                        <li>• Withdrawals are processed instantly</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleUpdateSettings}
                    disabled={!hasSettingsChanges || isUpdatingSettings}
                    className="flex-1 bg-background text-foreground border-2"
                    style={{ borderColor: "#d4af37" }}
                  >
                    {isUpdatingSettings ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Settings
                      </>
                    )}
                  </Button>
                  {hasSettingsChanges && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPhone(originalValues.phone);
                      }}
                      disabled={isUpdatingSettings}
                      className="bg-background text-foreground border-2"
                      style={{ borderColor: "#d4af37" }}
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* // Wallet Modal
        <WalletModal
          isOpen={showWalletModal}
          onClose={handleWalletModalClose}
        /> */}

        {/* Account Modal */}
        <AccountModal
          isOpen={showAccountModal}
          onClose={() => setShowAccountModal(false)}
        />

        {/* KYC Modal */}
        <Dialog open={showKycModal} onOpenChange={setShowKycModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center">
                Complete Your KYC
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Identity Verification Required
                </h3>
                <p className="text-muted-foreground text-sm">
                  To comply with regulations and unlock full platform features,
                  we need to verify your identity.
                </p>
              </div>

              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-medium text-foreground mb-2">
                    What you'll need:
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Government-issued ID (passport, driver's license)</li>
                    <li>• Proof of address (utility bill, bank statement)</li>
                    <li>• Selfie with your ID</li>
                  </ul>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-900 mb-2">
                    Benefits of KYC:
                  </h4>
                  <ul className="text-sm text-green-800 space-y-1">
                    <li>• Higher transaction limits</li>
                    <li>• Access to advanced features</li>
                    <li>• Enhanced security</li>
                    <li>• Priority support</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowKycModal(false)}
                  className="flex-1"
                >
                  Maybe Later
                </Button>
                <Button
                  onClick={() => {
                    setShowKycModal(false);
                    setShowKycTypeModal(true);
                  }}
                  className="flex-1 bg-primary hover:bg-primary/90"
                >
                  Start Verification
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* KYC Type Selection Modal */}
        <Dialog open={showKycTypeModal} onOpenChange={setShowKycTypeModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center">
                Select Verification Type
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-muted-foreground text-sm">
                  Choose the type of verification that applies to you
                </p>
              </div>

              <div className="space-y-4">
                <Button
                  onClick={() => {
                    setShowKycTypeModal(false);
                    router.push("/kyc?type=individual");
                  }}
                  className="w-full h-auto p-6 flex flex-col items-center space-y-3 bg-background text-foreground border-2 hover:bg-muted/50"
                  style={{ borderColor: "#d4af37" }}
                  variant="outline"
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Shield className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-semibold text-lg">Individual</h3>
                    <p className="text-sm text-muted-foreground">
                      Personal identity verification for individual users
                    </p>
                  </div>
                </Button>

                <Button
                  onClick={() => {
                    setShowKycTypeModal(false);
                    router.push("/kyc?type=business");
                  }}
                  className="w-full h-auto p-6 flex flex-col items-center space-y-3 bg-background text-foreground border-2 hover:bg-muted/50"
                  style={{ borderColor: "#d4af37" }}
                  variant="outline"
                >
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Shield className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-semibold text-lg">Business</h3>
                    <p className="text-sm text-muted-foreground">
                      Business entity verification for companies and
                      organizations
                    </p>
                  </div>
                </Button>
              </div>

              <Button
                variant="outline"
                onClick={() => setShowKycTypeModal(false)}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
