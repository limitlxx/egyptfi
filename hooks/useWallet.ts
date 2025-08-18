import { useState } from "react";
import {
  type Connector,
  useAccount,
  useConnect,
  useDisconnect,
  useNetwork,
} from "@starknet-react/core";
import {
  type StarknetkitConnector,
  useStarknetkitConnectModal,
} from "starknetkit";
import toast from "react-hot-toast";
import { availableConnectors } from "@/connectors";

export const useWallet = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const { address, isConnected, connector: activeConnector } = useAccount();
  const { connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { chain } = useNetwork();

  const { starknetkitConnectModal } = useStarknetkitConnectModal({
    connectors: availableConnectors as StarknetkitConnector[],
  });

  const connectWithModal = async () => {
    try {
      setIsConnecting(true);
      const { connector } = await starknetkitConnectModal();
      
      if (!connector) {
        throw new Error("No connector selected");
      }
      
      await connectAsync({ connector: connector as Connector });
      toast.success("Wallet connected successfully");
      return { success: true, connector };
    } catch (error) {
      console.error("Connection error:", error);
      toast.error("Failed to connect wallet");
      return { success: false, error };
    } finally {
      setIsConnecting(false);
    }
  };

  const connectDirectly = async (connector: StarknetkitConnector) => {
    try {
      setIsConnecting(true);
      await connectAsync({ connector: connector as unknown as Connector });
      toast.success(`Connected to ${connector.wallet?.name || connector.id}`);
      return { success: true, connector };
    } catch (error) {
      console.error("Connection error:", error);
      toast.error(`Failed to connect to ${connector.wallet?.name || connector.id}`);
      return { success: false, error };
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      await disconnectAsync();
      toast.success("Wallet disconnected");
      return { success: true };
    } catch (error) {
      console.error("Disconnect error:", error);
      toast.error("Failed to disconnect wallet");
      return { success: false, error };
    }
  };

  const formatAddress = (addr: string | undefined, chars = 6) => {
    if (!addr) return "";
    return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
  };

  return {
    // Connection state
    address,
    isConnected,
    isConnecting,
    connector: activeConnector,
    chain,
    
    // Connection methods
    connectWithModal,
    connectDirectly,
    disconnect,
    
    // Available connectors
    availableConnectors: availableConnectors as StarknetkitConnector[],
    
    // Utilities
    formatAddress,
  };
};