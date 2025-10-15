// "use client";

// import { useState } from "react";
// import { ArrowDownToLine, Loader2 } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
//   DialogTrigger,
// } from "@/components/ui/dialog";
// import { useWithdrawMerchantCalls } from "@/hooks/useWithdrawMerchantCalls";
// import { usePaymaster } from "@/hooks/usePayMaster";
// import { WithdrawalService } from "@/services/WithdrawService";
// import { useToast } from "@/hooks/use-toast";

// interface WithdrawalDialogProps {
//   availableBalance: number;
//   merchantwallet: string;
//   refetchMerchantInfo: () => Promise<void>;
// }

// export function WithdrawalDialog({
//   availableBalance,
//   merchantwallet,
//   refetchMerchantInfo,
// }: WithdrawalDialogProps) {
//   const { toast } = useToast();
//   const [withdrawAmount, setWithdrawAmount] = useState("");
//   const [withdrawPin, setWithdrawPin] = useState("");
//   const [customSettlementAddress, setCustomSettlementAddress] = useState("");
//   const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
//   const [isWithdrawing, setIsWithdrawing] = useState(false);

//   // Prepare withdrawal calls (enabled only when dialog is open)
//   const { calls: withdrawCalls } = useWithdrawMerchantCalls({
//     amount: withdrawAmount,
//     enabled:
//       isWithdrawOpen && !!withdrawAmount && parseFloat(withdrawAmount) > 0,
//   });

//   // Use paymaster for transaction (sponsored or free mode)
//   const {
//     executeTransaction: executeWithdraw,
//     isLoading: isWithdrawTxLoading,
//     paymentMode,
//   } = usePaymaster({
//     calls: withdrawCalls,
//     enabled: !!withdrawCalls,
//     onSuccess: (transactionHash: string) => {
//       toast({
//         title: "Withdrawal initiated",
//         description: `Transaction hash: ${transactionHash}. Funds will arrive shortly.`,
//       });
//       refetchMerchantInfo(); // Refetch balance after success
//     },
//     onError: (error: any) => {
//       toast({
//         title: "Withdrawal error",
//         description: error.message || "Transaction failed. Please try again.",
//         variant: "destructive",
//       });
//     },
//   });

//   // Handle withdrawal
//   const handleWithdraw = async () => {
//     const amountNum = parseFloat(withdrawAmount);
//     if (amountNum <= 0 || amountNum > availableBalance) {
//       toast({
//         title: "Invalid amount",
//         description: "Please enter a valid amount within your balance.",
//         variant: "destructive",
//       });
//       return;
//     }

//     if (!withdrawCalls) {
//       toast({
//         title: "Transaction not ready",
//         description: "Please try again.",
//         variant: "destructive",
//       });
//       return;
//     }

//     setIsWithdrawing(true);
//     try {
//       // Execute withdrawal and record in database
//       const withdrawal = await WithdrawalService.createWithdrawal({
//         merchantWallet: merchantwallet,
//         amount: withdrawAmount,
//         executeWithdraw,
//         calls: withdrawCalls,
//         paymentMode,
//       });

//       // Update balance optimistically
//       // Note: balance update is handled by refetchMerchantInfo in onSuccess

//       toast({
//         title: "Withdrawal successful",
//         description: `${withdrawAmount} USDC withdrawn to ${withdrawal.to_address}. Transaction hash: ${withdrawal.txHash}`,
//       });
//     } catch (error) {
//       console.error("Withdrawal failed:", error);
//       toast({
//         title: "Withdrawal failed",
//         description:
//           error instanceof Error ? error.message : "An error occurred",
//         variant: "destructive",
//       });
//     } finally {
//       setIsWithdrawing(false);
//       setIsWithdrawOpen(false);
//       setWithdrawAmount("");
//       setWithdrawPin("");
//     }
//   };

//   return (
//     <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
//       <DialogTrigger asChild>
//         <Button
//           className="w-full mt-4 bg-background text-foreground border-2"
//           style={{ borderColor: "#d4af37" }}
//         >
//           <ArrowDownToLine className="w-4 h-4 mr-2" />
//           Withdraw USDC
//         </Button>
//       </DialogTrigger>
//       <DialogContent className="sm:max-w-md">
//         <DialogHeader>
//           <DialogTitle>Withdraw USDC</DialogTitle>
//         </DialogHeader>
//         <div className="space-y-4">
//           <div>
//             <Label htmlFor="withdraw-amount">Amount (USDC)</Label>
//             <Input
//               id="withdraw-amount"
//               type="number"
//               step="0.000001" // For 6 decimals
//               value={withdrawAmount}
//               onChange={(e) => setWithdrawAmount(e.target.value)}
//               placeholder="Enter amount"
//               min="1"
//               max={availableBalance}
//             />
//           </div>
//           <div>
//             <Label htmlFor="withdraw-pin">Security PIN</Label>
//             <Input
//               id="withdraw-pin"
//               type="password"
//               value={withdrawPin}
//               onChange={(e) => setWithdrawPin(e.target.value)}
//               placeholder="Enter your PIN"
//               required
//             />
//           </div>
//           <div>
//             <Label htmlFor="settlement-address">
//               Settlement Wallet Address
//             </Label>
//             <Input
//               id="settlement-address"
//               type="text"
//               value={customSettlementAddress}
//               onChange={(e) => setCustomSettlementAddress(e.target.value)}
//               placeholder="Enter Starknet wallet address (0x...)"
//               className="font-mono text-sm"
//             />
//           </div>
//           <Button
//             onClick={handleWithdraw}
//             disabled={isWithdrawing || isWithdrawTxLoading || !withdrawAmount}
//           >
//             {isWithdrawing || isWithdrawTxLoading ? (
//               <>
//                 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
//                 Processing...
//               </>
//             ) : (
//               "Withdraw"
//             )}
//           </Button>
//         </div>
//       </DialogContent>
//     </Dialog>
//   );
// }
// components/WithdrawalDialog.tsx
import React, { useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTransfer, useGetWallet } from "@chipi-stack/chipi-react";
import { WithdrawalService } from "@/services/WithdrawService";
import { useUser, useAuth, useSignUp } from "@clerk/nextjs";
import { validateAndParseAddress } from "starknet";

type WithdrawalDialogProps = {
  availableBalance: number;
  merchantwallet: string;
  refetchMerchantInfo: () => Promise<void>;
  settlementWallet: string;
  kycStatus: string | null;
  setShowKycModal: (open: boolean) => void;
  getToken: () => Promise<string | null>;
};

const WithdrawalDialog: React.FC<WithdrawalDialogProps> = ({
  availableBalance,
  merchantwallet,
  refetchMerchantInfo,
  settlementWallet,
  kycStatus,
  setShowKycModal,
  getToken,
}) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawPin, setWithdrawPin] = useState("");
  const [customSettlementAddress, setCustomSettlementAddress] = useState("");
  const {
    transferAsync,
    isLoading: isTransferLoading,
    error: transferError,
  } = useTransfer();
  const {
    getWalletAsync,
    data: senderWallet,
    isLoading: isWalletLoading,
    error: walletError,
  } = useGetWallet();
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const { user, isLoaded } = useUser();

  const isValidStarknetAddress = (address: string): boolean => {
    try {
      validateAndParseAddress(address);
      return true;
    } catch {
      return false;
    }
  };

  const handleWithdraw = async () => {
    console.log("tumi");
    // if (kycStatus !== "verified") {
    //   toast({
    //     title: "KYC Required",
    //     description: "Please complete KYC verification to withdraw funds.",
    //     variant: "destructive",
    //   });
    //   setShowKycModal(true);
    //   setIsOpen(false);
    //   return;
    // }

    const amountNum = parseFloat(withdrawAmount);
    if (amountNum <= 0 || amountNum > availableBalance) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount within your balance.",
        variant: "destructive",
      });
      return;
    }
    console.log(amountNum);

    if (!withdrawPin) {
      toast({
        title: "PIN required",
        description: "Please enter your security PIN to proceed.",
        variant: "destructive",
      });
      return;
    }
    console.log(withdrawPin);
    if (!isValidStarknetAddress(customSettlementAddress)) {
      toast({
        title: "Invalid wallet address",
        description: "Please enter a valid Starknet wallet address.",
        variant: "destructive",
      });
      return;
    }
    console.log(customSettlementAddress);
    setIsWithdrawing(true);
    try {
      const bearerToken = await getToken();
      console.log("bearertoken", bearerToken);
      if (!bearerToken) {
        throw new Error("No bearer token found");
      }
      console.log("tumi");
      console.log("user", user?.id);
      console.log("external ID", user?.externalId);
      console.log("bearer token", bearerToken);
      // Fetch wallet if not loaded
      let wallet = senderWallet;
      if (!wallet) {
        wallet = await getWalletAsync({
          externalUserId: user?.id || "",
          bearerToken,
        });
      }

      console.log("wallet", wallet);
      const result = await transferAsync({
        params: {
          encryptKey: withdrawPin,
          wallet,
          token: "USDC",
          // contractAddress: USDC_TOKEN.address,
          recipient: customSettlementAddress,
          amount: withdrawAmount,
          // decimals: USDC_TOKEN.decimals,
        },
        bearerToken,
      });
      console.log(result);

      // await WithdrawalService.createWithdrawal({
      //   merchantWallet: merchantwallet,
      //   amount: withdrawAmount,
      //   // txHash: result,
      //   // to_address: customSettlementAddress,
      // });

      toast({
        title: "Withdrawal successful",
        description: `${withdrawAmount} USDC withdrawn to ${customSettlementAddress}. Transaction hash: ${result}`,
      });

      await refetchMerchantInfo();
    } catch (error) {
      console.error("Withdrawal failed:", error);
      toast({
        title: "Withdrawal failed",
        description:
          (error as any)?.message || "An error occurred during the transfer.",
        variant: "destructive",
      });
    } finally {
      setIsWithdrawing(false);
      setIsOpen(false);
      setWithdrawAmount("");
      setWithdrawPin("");
      setCustomSettlementAddress(settlementWallet || "");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          className="bg-background text-foreground border-2"
          style={{ borderColor: "#d4af37" }}
        >
          Withdraw USDC
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Withdraw USDC</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="withdraw-amount">Amount (USDC)</Label>
            <Input
              id="withdraw-amount"
              type="number"
              step="0.000001"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Enter amount"
              min="1"
              max={availableBalance}
              disabled={isWalletLoading || isWithdrawing || isTransferLoading}
            />
          </div>
          <div>
            <Label htmlFor="withdraw-pin">Security PIN</Label>
            <Input
              id="withdraw-pin"
              type="password"
              value={withdrawPin}
              onChange={(e) => setWithdrawPin(e.target.value)}
              placeholder="Enter your PIN"
              required
              disabled={isWalletLoading || isWithdrawing || isTransferLoading}
            />
          </div>
          <div>
            <Label htmlFor="settlement-address">
              Settlement Wallet Address
            </Label>
            <Input
              id="settlement-address"
              type="text"
              value={customSettlementAddress}
              onChange={(e) => setCustomSettlementAddress(e.target.value)}
              placeholder="Enter Starknet wallet address (0x...)"
              className="font-mono text-sm"
              disabled={isWalletLoading || isWithdrawing || isTransferLoading}
            />
            {/* <p className="text-sm text-muted-foreground mt-1">
              Default: {settlementWallet || "Not set"}
            </p> */}
            {!isValidStarknetAddress(customSettlementAddress) &&
              customSettlementAddress && (
                <p className="text-sm text-red-600 mt-1">
                  Invalid Starknet address
                </p>
              )}
            {/* <Button
              variant="outline"
              onClick={() => setCustomSettlementAddress(settlementWallet || "")}
              disabled={isWalletLoading || isWithdrawing || isTransferLoading}
              className="mt-2 bg-background text-foreground border-2"
              style={{ borderColor: "#d4af37" }}
            >
              Use Default Address
            </Button> */}
          </div>
          <Button
            onClick={handleWithdraw}
            disabled={
              isWalletLoading ||
              isWithdrawing ||
              isTransferLoading ||
              !withdrawAmount ||
              !withdrawPin ||
              !isValidStarknetAddress(customSettlementAddress)
            }
            className="bg-background text-foreground border-2"
            style={{ borderColor: "#d4af37" }}
          >
            {isWalletLoading || isWithdrawing || isTransferLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              "Withdraw"
            )}
          </Button>
          {walletError && (
            <p className="text-sm text-red-600">
              Wallet Error: {walletError.message}
            </p>
          )}
          {transferError && (
            <p className="text-sm text-red-600">
              Transfer Error: {transferError.message}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WithdrawalDialog;