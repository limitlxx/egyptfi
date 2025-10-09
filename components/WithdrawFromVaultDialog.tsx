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
import { useCallAnyContract } from "@chipi-stack/chipi-react";
import { useUser, useAuth } from "@clerk/nextjs";
import { useGetWallet } from "@chipi-stack/chipi-react";

type WithdrawFromVaultDialogProps = {
  availableBalance: number;
  merchantwallet: string;
  refetchMerchantInfo: () => Promise<void>;
  getToken: () => Promise<string | null>;
};

const WithdrawFromVaultDialog: React.FC<WithdrawFromVaultDialogProps> = ({
  availableBalance,
  merchantwallet,
  refetchMerchantInfo,
  getToken,
}) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawPin, setWithdrawPin] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const { callAnyContractAsync } = useCallAnyContract();
  const { user } = useUser();
  const { getWalletAsync } = useGetWallet();

  // Define vault and chipipay addresses - these should be configured properly
  const vaultAddress = "0xYOUR_VAULT_CONTRACT_ADDRESS"; // Replace with actual vault contract address
  const chipipayAddress = merchantwallet; // Use merchant wallet as chipipay address

  const handleWithdraw = async () => {
    const amountNum = parseFloat(withdrawAmount);
    // if (amountNum <= 0 || amountNum > availableBalance) {
    //   toast({
    //     title: "Invalid amount",
    //     description: "Please enter a valid amount within your balance.",
    //     variant: "destructive",
    //   });
    //   return;
    // }

    if (!withdrawPin) {
      toast({
        title: "PIN required",
        description: "Please enter your security PIN to proceed.",
        variant: "destructive",
      });
      return;
    }

    setIsWithdrawing(true);
    try {
      const bearerToken = await getToken();
      if (!bearerToken) {
        throw new Error("No bearer token found");
      }

      // Get sender wallet
      const senderWallet = await getWalletAsync({
        externalUserId: user?.id || "",
        bearerToken,
      });

      const yieldAmount = amountNum; // The amount to withdraw

      // Convert to wei (USDC has 6 decimals)
      const amountInWei = (yieldAmount * 10 ** 6).toString();

      // Vault to Chipipay transfer
      await callAnyContractAsync({
        params: {
          encryptKey: withdrawPin,
          wallet: senderWallet,
          contractAddress: vaultAddress,
          calls: [
            {
              contractAddress: vaultAddress,
              entrypoint: "transfer", // Adjust to your vault contract's method (e.g., 'move_to_chipipay')
              calldata: [chipipayAddress, amountInWei], // Adjust calldata (e.g., [amount, chipipay])
            },
          ],
        },
        bearerToken,
      });

      toast({
        title: "Withdrawal from vault successful",
        description: `${withdrawAmount} USDC withdrawn from vault to chipipay wallet.`,
      });

      await refetchMerchantInfo();
    } catch (error) {
      console.error("Withdrawal from vault failed:", error);
      toast({
        title: "Withdrawal failed",
        description:
          (error as Error)?.message ||
          "An error occurred during the withdrawal.",
        variant: "destructive",
      });
    } finally {
      setIsWithdrawing(false);
      setIsOpen(false);
      setWithdrawAmount("");
      setWithdrawPin("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          className="w-full mt-4 bg-background text-foreground border-2"
          style={{ borderColor: "#d4af37" }}
        >
          Withdraw from Vault
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Withdraw from Vault</DialogTitle>
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
              disabled={isWithdrawing}
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
              disabled={isWithdrawing}
            />
          </div>
          <Button
            onClick={handleWithdraw}
            disabled={isWithdrawing || !withdrawAmount || !withdrawPin}
            className="bg-background text-foreground border-2"
            style={{ borderColor: "#d4af37" }}
          >
            {isWithdrawing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              "Withdraw from Vault"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WithdrawFromVaultDialog;
