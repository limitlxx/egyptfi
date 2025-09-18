import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useCreateWallet } from '@chipi-stack/nextjs';
import { generateEncryptKey, createInvisibleWallet, updateMerchantWallet } from '../app/signup/wallet-utils';

// Mock the Chipi SDK hook
vi.mock('@chipi-stack/nextjs', () => ({
  useCreateWallet: vi.fn(() => ({
    createWalletAsync: vi.fn(),
    isLoading: false,
  })),
}));

// Mock fetch for backend update
global.fetch = vi.fn();

describe('Wallet Creation Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('localStorage', {
      setItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  describe('generateEncryptKey', () => {
    it('should generate a 32-character hex string', () => {
      const key = generateEncryptKey();
      expect(key).toHaveLength(32);
      expect(key).toMatch(/^[0-9a-f]{32}$/);
    });
  });

  describe('createInvisibleWallet', () => {
    const mockDbResult = {
      merchant: { id: 'test-merchant-1' },
      apiKeys: { testnet: { jwt: 'mock-jwt-token' } },
    };

    const mockWalletResponse = {
      publicKey: '0xmockwalletaddress1234567890abcdef',
      address: '0xmockaddress',
    };

    it('should create wallet successfully and update merchant', async () => {
      const mockCreateWalletAsync = vi.fn().mockResolvedValue(mockWalletResponse);
      (useCreateWallet as any).mockReturnValue({
        createWalletAsync: mockCreateWalletAsync,
        isLoading: false,
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });
      (global.fetch as any).mockImplementation(mockFetch);

      const setLoading = vi.fn();
      const setError = vi.fn();

      await act(async () => {
        await createInvisibleWallet(mockDbResult, setLoading, setError, mockCreateWalletAsync);
      });

      expect(mockCreateWalletAsync).toHaveBeenCalledWith({
        params: {
          encryptKey: expect.stringMatching(/^[0-9a-f]{32}$/),
          externalUserId: 'test-merchant-1',
        },
        bearerToken: 'mock-jwt-token',
      });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'encryptKey_test-merchant-1',
        expect.stringMatching(/^[0-9a-f]{32}$/)
      );

      expect(mockFetch).toHaveBeenCalledWith('/api/merchants/update-wallet', expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-jwt-token',
        },
        body: JSON.stringify({
          merchantId: 'test-merchant-1',
          chipiWalletAddress: '0xmockwalletaddress1234567890abcdef',
        }),
      }));
    });

    it('should handle wallet creation error', async () => {
      const mockCreateWalletAsync = vi.fn().mockRejectedValue(new Error('SDK error'));
      (useCreateWallet as any).mockReturnValue({
        createWalletAsync: mockCreateWalletAsync,
        isLoading: false,
      });

      const setLoading = vi.fn();
      const setError = vi.fn();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await act(async () => {
        await createInvisibleWallet(mockDbResult, setLoading, setError, mockCreateWalletAsync);
      });

      expect(mockCreateWalletAsync).toHaveBeenCalled();
      expect(setError).toHaveBeenCalledWith('SDK error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Wallet creation failed:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });

    it('should handle missing JWT error', async () => {
      const mockDbResultNoJwt = {
        merchant: { id: 'test-merchant-1' },
        apiKeys: { testnet: { jwt: undefined } },
      };

      const setLoading = vi.fn();
      const setError = vi.fn();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await act(async () => {
        await createInvisibleWallet(mockDbResultNoJwt, setLoading, setError, vi.fn());
      });

      expect(setError).toHaveBeenCalledWith('No JWT token available for wallet creation');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('updateMerchantWallet', () => {
    it('should update merchant wallet successfully', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });
      (global.fetch as any).mockImplementation(mockFetch);

      await act(async () => {
        await updateMerchantWallet('test-merchant-1', '0xwallet', 'mock-jwt');
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/merchants/update-wallet', expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-jwt',
        },
        body: JSON.stringify({
          merchantId: 'test-merchant-1',
          chipiWalletAddress: '0xwallet',
        }),
      }));
    });

    it('should handle update error', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Fetch error'));
      (global.fetch as any).mockImplementation(mockFetch);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await act(async () => {
        await updateMerchantWallet('test-merchant-1', '0xwallet', 'mock-jwt');
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error updating merchant wallet:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});