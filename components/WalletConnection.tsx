"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Copy, ExternalLink, LogOut, Wallet } from "lucide-react";
import WalletModal from "./WalletModal";
import { useWallet } from "@/hooks/useWallet";
import toast from "react-hot-toast";

export default function WalletConnection() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { 
    address, 
    isConnected, 
    isConnecting, 
    connector, 
    chain,
    disconnect, 
    formatAddress 
  } = useWallet();

  const copyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      toast.success("Address copied to clipboard");
    }
  };

  const openExplorer = () => {
    if (address && chain) {
      // Get the appropriate explorer URL based on the chain
      let explorerUrl = '';
      if (chain.name === 'Starknet') {
        explorerUrl = 'https://starkscan.co';
      } else if (chain.name === 'Starknet Sepolia' || chain.testnet) {
        explorerUrl = 'https://sepolia.starkscan.co';
      } else {
        explorerUrl = 'https://starkscan.co'; // Default to mainnet
      }
      
      window.open(`${explorerUrl}/contract/${address}`, '_blank');
    }
  };

  if (isConnected && address) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">
              {formatAddress(address)}
            </span>
            <span className="sm:hidden">
              {formatAddress(address, 4)}
            </span>
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">Connected Wallet</p>
            <p className="text-xs text-muted-foreground">
              {connector?.name || "Unknown Wallet"}
            </p>
          </div>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={copyAddress} className="cursor-pointer">
            <Copy className="mr-2 h-4 w-4" />
            Copy Address
          </DropdownMenuItem>
          
          {chain && (
            <DropdownMenuItem onClick={openExplorer} className="cursor-pointer">
              <ExternalLink className="mr-2 h-4 w-4" />
              View on Explorer
            </DropdownMenuItem>
          )}
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem 
            onClick={disconnect} 
            className="cursor-pointer text-red-600 hover:text-red-700"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      <Button 
        onClick={() => setIsModalOpen(true)}
        disabled={isConnecting}
        className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
      >
        <Wallet className="h-4 w-4" />
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </Button>
      
      <WalletModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </>
  );
}