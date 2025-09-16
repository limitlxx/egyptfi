// components/PaymentModeIndicator.tsx
"use client";

import { usePaymasterCredits } from "@/hooks/usePaymasterCredits";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle, 
  AlertTriangle, 
  Zap, 
  CreditCard, 
  RefreshCw,
  Info
} from "lucide-react";
import { feltToInt } from "@/lib/felt252-utils";

interface PaymentModeIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

export function   PaymentModeIndicator({ className = "", showDetails = true }: PaymentModeIndicatorProps) {
  const { 
    shouldUseFreeMode, 
    getCreditsStatus, 
    checkCredits, 
    isLoading,
    activity 
  } = usePaymasterCredits();

  const creditsStatus = getCreditsStatus();

  const getStatusConfig = () => {
    switch (creditsStatus) {
      case 'sufficient':
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          color: 'text-green-600',
          bgColor: 'bg-green-50 border-green-200',
          title: 'Gas Fees Sponsored',
          description: 'Your transaction fees will be covered - no cost to you!',
          badge: { text: 'Sponsored', variant: 'default' as const }
        };
      case 'low':
        return {
          icon: <AlertTriangle className="w-4 h-4" />,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50 border-orange-200',
          title: 'Low Credits - Sponsored Mode',
          description: 'Gas fees still covered, but credits are running low.',
          badge: { text: 'Sponsored', variant: 'secondary' as const }
        };
      case 'exhausted':
        return {
          icon: <CreditCard className="w-4 h-4" />,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50 border-blue-200',
          title: 'Gas fees not covered',
          description: 'You\'ll pay gas fees with your preferred token (ETH/STRK).',
          badge: { text: 'Free Mode', variant: 'outline' as const }
        };
      default:
        return {
          icon: <Info className="w-4 h-4" />,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50 border-gray-200',
          title: 'Checking Payment Mode...',
          description: 'Determining the best payment method for your transaction.',
          badge: { text: 'Checking...', variant: 'secondary' as const }
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={className}>
      <Alert className={`${config.bgColor} ${config.color}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {config.icon}
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="font-medium">{config.title}</h4>
                <Badge variant={config.badge.variant}>{config.badge.text}</Badge>
              </div>
              {showDetails && (
                <AlertDescription className="mt-1">
                  {config.description}
                </AlertDescription>
              )}
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={checkCredits}
            disabled={isLoading}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </Alert>

      {/* Detailed breakdown for admin/debug */}
      {showDetails && activity && creditsStatus !== 'unknown' && (
        <div className="mt-3 text-xs text-gray-600 space-y-1">
          <div className="flex justify-between">
            <span>ETH Credits:</span>
            <span className="font-mono">{feltToInt(BigInt(activity.remainingCredits))} ETH</span>
          </div>
          <div className="flex justify-between">
            <span>STRK Credits:</span>
            <span className="font-mono">{feltToInt(BigInt(activity.remainingStrkCredits))} STRK</span>
          </div>  
          <div className="flex justify-between">
            <span>Total Transactions:</span>
            <span>{activity.txCount}</span>
          </div>
        </div>
      )}
    </div>
  );
}