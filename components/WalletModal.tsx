"use client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  type Connector,
  useConnect,
} from "@starknet-react/core";
import { useState } from "react";
import toast from "react-hot-toast";
import {
  type StarknetkitConnector,
  useStarknetkitConnectModal,
} from "starknetkit";
import { availableConnectors } from "@/connectors";

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WalletModal = ({ isOpen, onClose }: WalletModalProps) => {
  const { connectAsync, connectors } = useConnect();
  const [isConnecting, setIsConnecting] = useState(false);
  
  const { starknetkitConnectModal } = useStarknetkitConnectModal({
    connectors: availableConnectors as StarknetkitConnector[],
  });

  // Handle direct modal for starknetkit connect ---commented below
  const handleConnectWithModal = async () => {
    try {
      setIsConnecting(true);
      const { connector } = await starknetkitConnectModal();
      
      if (!connector) {
        return;
      }
      
      await connectAsync({ connector: connector as Connector });
      toast.success("Wallet connected successfully");
      onClose();
    } catch (err) {
      console.error("Connection error:", err);
      toast.error("Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDirectConnect = async (connector: Connector) => {
    try {
      setIsConnecting(true);
      await connectAsync({ connector });
      toast.success("Wallet connected successfully");
      onClose();
    } catch (err) {
      console.error("Connection error:", err);
      toast.error("Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  };

  // Helper function to get wallet info
  const getWalletInfo = (connector: Connector) => {
    const walletMap: Record<string, { name: string; icon?: string }> = {
      'argentX': {
        name: 'Ready Web',
        icon: 'https://cdn.prod.website-files.com/680f9220d4668b0e40862420/68501db2b0ca6f407c20579f_ready-logo-linear-inverted.svg'
      },
      'braavos': {
        name: 'Braavos',
        icon: 'https://braavos.app/assets/favicon.ico'
      },
      'argentMobile': {
        name: 'Ready Mobile',
        icon: 'https://www.argent.xyz/favicon.ico'
      },
      'argentWebWallet': {
        name: 'Ready Email',
        icon: 'https://www.argent.xyz/favicon.ico'
      }
    };

    return walletMap[connector.id] || { name: connector.id, icon: undefined };
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-card border border-border">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-bold">
            Connect Your Wallet
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-6">
          {/* StarknetKit Modal Button */}
          <Button
            variant="default"
            className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            onClick={handleConnectWithModal}
            disabled={isConnecting}
          >
            {isConnecting ? "Connecting..." : "Connect with StarknetKit Modal"}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or connect directly
              </span>
            </div>
          </div>

          {/* Individual Connector Buttons */}
          {connectors.map((connector: Connector) => {
            const walletInfo = getWalletInfo(connector);
            return (
              <Button
                key={connector.id}
                variant="outline"
                className="w-full h-16 flex items-center justify-start gap-4 p-4"
                onClick={() => handleDirectConnect(connector)}
                disabled={isConnecting}
              >
                {walletInfo.icon && (
                  <img 
                    src={walletInfo.icon} 
                    className="w-[30px] h-[30px]" 
                    alt={walletInfo.name}
                    onError={(e) => {
                      // Hide image if it fails to load
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                <div className="text-left">
                  <div className="font-semibold">
                    {walletInfo.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Connect directly to wallet
                  </div>
                </div>
              </Button>
            );
          })}
        </div>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          Connect your wallet to use the application.
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WalletModal;