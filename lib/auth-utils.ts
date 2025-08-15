interface StoredKeys {
  publicKey: string;
  jwt: string;
}

interface MerchantInfo {
  id: string;
  businessName: string;
  businessEmail: string;
  walletAddress: string;
  createdAt: string;
}

export class AuthManager {
  private static readonly MERCHANT_KEY = 'merchant';
  private static readonly TESTNET_KEYS_KEY = 'testnet_keys';
  private static readonly MAINNET_KEYS_KEY = 'mainnet_keys';
  private static readonly CURRENT_ENV_KEY = 'current_environment';

  static getMerchantInfo(): MerchantInfo | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const merchant = localStorage.getItem(this.MERCHANT_KEY);
      return merchant ? JSON.parse(merchant) : null;
    } catch {
      return null;
    }
  }

  static setMerchantInfo(merchant: MerchantInfo): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.MERCHANT_KEY, JSON.stringify(merchant));
  }

  static getApiKeys(environment: 'testnet' | 'mainnet'): StoredKeys | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const key = environment === 'testnet' ? this.TESTNET_KEYS_KEY : this.MAINNET_KEYS_KEY;
      const keys = localStorage.getItem(key);
      return keys ? JSON.parse(keys) : null;
    } catch {
      return null;
    }
  }

  static setApiKeys(environment: 'testnet' | 'mainnet', keys: StoredKeys): void {
    if (typeof window === 'undefined') return;
    
    const key = environment === 'testnet' ? this.TESTNET_KEYS_KEY : this.MAINNET_KEYS_KEY;
    localStorage.setItem(key, JSON.stringify(keys));
  }

  static getCurrentEnvironment(): 'testnet' | 'mainnet' {
    if (typeof window === 'undefined') return 'testnet';
    
    return localStorage.getItem(this.CURRENT_ENV_KEY) as 'testnet' | 'mainnet' || 'testnet';
  }

  static setCurrentEnvironment(environment: 'testnet' | 'mainnet'): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.CURRENT_ENV_KEY, environment);
  }

  static getAuthHeaders(environment?: 'testnet' | 'mainnet'): HeadersInit {
    const env = environment || this.getCurrentEnvironment();
    const keys = this.getApiKeys(env);
    
    if (!keys?.jwt) {
      throw new Error(`No JWT token found for ${env} environment`);
    }

    return {
      'Authorization': `Bearer ${keys.jwt}`,
      'Content-Type': 'application/json',
    };
  }

  static async makeAuthenticatedRequest(
    url: string, 
    options: RequestInit = {}, 
    environment?: 'testnet' | 'mainnet'
  ): Promise<Response> {
    const headers = {
      ...this.getAuthHeaders(environment),
      ...options.headers,
    };

    return fetch(url, {
      ...options,
      headers,
    });
  }

  static clearAuth(): void {
    if (typeof window === 'undefined') return;
    
    localStorage.removeItem(this.MERCHANT_KEY);
    localStorage.removeItem(this.TESTNET_KEYS_KEY);
    localStorage.removeItem(this.MAINNET_KEYS_KEY);
    localStorage.removeItem(this.CURRENT_ENV_KEY);
  }

  static isAuthenticated(): boolean {
    const merchant = this.getMerchantInfo();
    const currentEnv = this.getCurrentEnvironment();
    const keys = this.getApiKeys(currentEnv);
    
    return !!(merchant && keys?.jwt);
  }
}