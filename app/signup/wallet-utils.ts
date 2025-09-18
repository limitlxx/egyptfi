import { useCreateWallet } from "@chipi-stack/nextjs";
import toast from "react-hot-toast";

export const generateEncryptKey = (): string => {
  // Client-safe hex generator (32 chars)
  let result = '';
  const hexChars = '0123456789abcdef';
  for (let i = 0; i < 32; i++) {
    result += hexChars.charAt(Math.floor(Math.random() * hexChars.length));
  }
  return result;
};

export const createInvisibleWallet = async (dbResult: any, setLoading: (loading: boolean) => void, setError: (error: string | null) => void, createWalletAsync: any) => {
  const merchant = dbResult.merchant;
  const encryptKey = generateEncryptKey();
  const testnetJWT = dbResult.apiKeys?.testnet?.jwt;

  if (!testnetJWT) {
    setError('No JWT token available for wallet creation');
    toast.error('Failed to create wallet: No authentication token');
    return;
  }

  setLoading(true);
  setError(null);

  try {
    console.log('Creating invisible wallet for merchant:', merchant.id);

    const walletResponse = await createWalletAsync({
      params: {
        encryptKey,
        externalUserId: merchant.id,
      },
      bearerToken: testnetJWT,
    });

    console.log('Wallet created successfully:', walletResponse);

    localStorage.setItem(`encryptKey_${merchant.id}`, encryptKey);
    toast.success('Invisible wallet created successfully!');

    const publicKey = (walletResponse as any).publicKey || (walletResponse as any).wallet?.publicKey || walletResponse.address;
    if (publicKey) {
      await updateMerchantWallet(merchant.id, publicKey, testnetJWT);
    } else {
      console.warn('Wallet response did not contain publicKey; skipping update');
    }

  } catch (error) {
    console.error('Wallet creation failed:', error);
    const errorMsg = error instanceof Error ? error.message : 'Wallet creation failed';
    setError(errorMsg);
    toast.error(`Wallet creation failed: ${errorMsg}`);
  } finally {
    setLoading(false);
  }
};

export const updateMerchantWallet = async (merchantId: string, walletAddress: string, jwtToken: string) => {
  try {
    const response = await fetch('/api/merchants/update-wallet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`,
      },
      body: JSON.stringify({
        merchantId,
        chipiWalletAddress: walletAddress,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log('Merchant wallet updated successfully');
      toast.success('Wallet linked to merchant account');
    } else {
      console.error('Failed to update merchant wallet:', data.error);
      toast.error('Wallet created but failed to update merchant record');
    }
  } catch (error) {
    console.error('Error updating merchant wallet:', error);
    toast.error('Failed to link wallet to merchant account');
  }
};