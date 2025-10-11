import { useState, useEffect, useCallback } from 'react';
import { getSponsorActivity } from '@/services/paymasterService';
import toast from 'react-hot-toast';

interface PaymasterActivity {
  name: string;
  succeededTxCount: number;
  revertedTxCount: number;
  txCount: number;
  succeededGasFees: string;
  revertedGasFees: string;
  gasFees: string;
  succeededStrkGasFees: string;
  revertedStrkGasFees: string;
  strkGasFees: string;
  remainingCredits: string;
  remainingStrkCredits: string;
}

interface PaymasterCreditsState {
  activity: PaymasterActivity | null;
  isLoading: boolean;
  error: string | null;
  lastChecked: Date | null;
  hasCredits: boolean;
  hasStrkCredits: boolean;
  shouldUseFreeMode: boolean;
}

export function usePaymasterCredits() {
  const [state, setState] = useState<PaymasterCreditsState>({
    activity: null,
    isLoading: false,
    error: null,
    lastChecked: null,
    hasCredits: false,
    hasStrkCredits: false,
    shouldUseFreeMode: false,
  });

  const checkCredits = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const activity = await getSponsorActivity({
        apiKey: process.env.NEXT_PUBLIC_PAYMASTER_API,
        baseUrl: 'https://starknet.api.avnu.fi/paymaster/v1',
      });

      // Map AVNU API response to PaymasterActivity (adjust field names as needed)
      const mappedActivity: PaymasterActivity = {
        name: activity.name || 'Paymaster',
        succeededTxCount: activity.succeededTxCount || 0,
        revertedTxCount: activity.revertedTxCount || 0,
        txCount: activity.txCount || 0,
        succeededGasFees: activity.succeededGasFees || '0',
        revertedGasFees: activity.revertedGasFees || '0',
        gasFees: activity.gasFees || '0',
        succeededStrkGasFees: activity.succeededStrkGasFees || '0',
        revertedStrkGasFees: activity.revertedStrkGasFees || '0',
        strkGasFees: activity.strkGasFees || '0',
        remainingCredits: activity.remainingCredits?.toString() || '0',
        remainingStrkCredits: activity.remainingStrkCredits?.toString() || '0',
      };

      // Check if we have sufficient credits (threshold: 0.001 ETH and 1 STRK)
      const ethCredits = parseFloat(mappedActivity.remainingCredits);
      const strkCredits = parseFloat(mappedActivity.remainingStrkCredits);

      const hasCredits = ethCredits > 0.001;
      const hasStrkCredits = strkCredits > 1.0;
      const shouldUseFreeMode = !hasCredits && !hasStrkCredits;

      setState({
        activity: mappedActivity,
        isLoading: false,
        error: null,
        lastChecked: new Date(),
        hasCredits,
        hasStrkCredits,
        shouldUseFreeMode,
      });

      // Log warning if credits are low
      if (ethCredits < 0.01) {
        console.warn(`Low ETH credits: ${ethCredits} ETH remaining`);
      }
      if (strkCredits < 10) {
        console.warn(`Low STRK credits: ${strkCredits} STRK remaining`);
      }

    } catch (error) {
      console.error('Error checking paymaster credits:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to check credits';
      toast.error(errorMessage);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        // Default to free mode if we can't check credits
        shouldUseFreeMode: true,
      }));
    }
  }, []);

  // Auto-check credits on mount and periodically
  useEffect(() => {
    checkCredits();

    // Check credits every 5 minutes
    const interval = setInterval(checkCredits, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [checkCredits]);

  return {
    ...state,
    checkCredits,
    // Helper functions
    getCreditsStatus: () => {
      if (!state.activity) return 'unknown';
      if (state.shouldUseFreeMode) return 'exhausted';
      if (!state.hasCredits && !state.hasStrkCredits) return 'low';
      return 'sufficient';
    },
    getRecommendedMode: () => {
      return state.shouldUseFreeMode ? 'free' : 'sponsored';
    },
  };
}