import toast from "react-hot-toast";

// paymasterService.ts

// Interface for the sponsor activity response (adjust based on actual API response)
interface SponsorActivity {
  credits?: number;
  remainingCredits?: string;
  remainingStrkCredits?: string;
  transactions?: Array<{
    txHash: string;
    amount: number;
    timestamp: string;
  }>;
  status?: string;
  [key: string]: any; // Allow additional fields
}

// Get sponsor activity from AVNU Paymaster API
export async function getSponsorActivity({
  apiKey = process.env.NEXT_PUBLIC_PAYMASTER_API || '', // Default API key
  baseUrl = process.env.NEXT_PUBLIC_PAYMASTER_API_URL || 'https://sepolia.api.avnu.fi',
}: {
  apiKey?: string;
  baseUrl?: string;
} = {}): Promise<SponsorActivity> {
  
  if (!apiKey) {
    console.error("Paymaster API key is missing");
    // Return default fallback instead of throwing
    return {
      remainingCredits: '0x0',
      remainingStrkCredits: '0x0',
      status: 'no_api_key'
    };
  }

  const headersList = {
    Accept: "*/*",
    "x-paymaster-api-key": apiKey,
  };

  try {
    // Use the correct endpoint based on environment
    const paymasterUrl = baseUrl.includes('sepolia') 
      ? 'https://sepolia.api.avnu.fi/paymaster/v1/sponsor-activity'
      : 'https://starknet.api.avnu.fi/paymaster/v1/sponsor-activity';

    console.log(`Fetching paymaster activity from: ${paymasterUrl}`);

    const response = await fetch(paymasterUrl, {
      method: "GET",
      headers: headersList,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      console.error(`Paymaster API error (${response.status}):`, errorText);
      
      // Return fallback instead of throwing - allows transaction to continue with default fee mode
      return {
        remainingCredits: '0x0',
        remainingStrkCredits: '0x0',
        status: 'api_error',
        error: errorText
      };
    }

    const data = await response.json();
    console.log("Paymaster activity fetched successfully:", data);
    
    return data;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error fetching sponsor activity";
    console.error("Sponsor activity error:", error);
    
    // Return fallback instead of throwing - graceful degradation
    return {
      remainingCredits: '0x0',
      remainingStrkCredits: '0x0',
      status: 'fetch_error',
      error: errorMessage
    };
  }
}