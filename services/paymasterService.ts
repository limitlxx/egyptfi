import toast from "react-hot-toast";

// Interface for the sponsor activity response (adjust based on actual API response)
interface SponsorActivity {
  credits?: number;
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
  const headersList = {
    Accept: "*/*",
    "api-key": apiKey,
  };

  try {
    const response = await fetch(`https://sepolia.api.avnu.fi/paymaster/v1/sponsor-activity`, {
      method: "GET",
      headers: headersList,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch sponsor activity: ${response.statusText}`);
    }

    const data = await response.json(); // Assuming JSON response
    return data;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error fetching sponsor activity";
    toast.error(errorMessage);
    console.error("Sponsor activity error:", error);
    throw error;
  }
}