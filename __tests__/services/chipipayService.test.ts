import { ChipiPayServiceImpl } from '../../services/chipipayService';
import {
  CreateWalletParams,
  TransferParams,
  ApproveParams,
  StakeParams,
  WithdrawParams,
  ContractCallParams,
  ChipiPayErrorCodes
} from '../../services/types/chipipay.types';

// Mock fetch globally
global.fetch = jest.fn();

describe('ChipiPayService', () => {
  let service: ChipiPayServiceImpl;
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    service = new ChipiPayServiceImpl('https://test-api.chipipay.com/v1');
    mockFetch.mockClear();
    jest.clearAllMocks();
    
    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createWallet', () => {
    const mockParams: CreateWalletParams = {
      encryptKey: 'test-pin-123',
      externalUserId: 'user-123',
      apiPublicKey: 'pk_test_123',
      bearerToken: 'bearer-token-123'
    };

    it('should successfully create a wallet', async () => {
      const mockResponse = {
        success: true,
        txHash: '0x123abc',
        wallet: {
          publicKey: '0xpublic123',
          encryptedPrivateKey: 'encrypted-private-key'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await service.createWallet(mockParams);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-api.chipipay.com/v1/wallet/create',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer bearer-token-123',
            'X-API-Key': 'pk_test_123'
          },
          body: JSON.stringify({
            encryptKey: 'test-pin-123',
            externalUserId: 'user-123'
          })
        })
      );

      expect(result).toEqual({
        success: true,
        txHash: '0x123abc',
        wallet: {
          publicKey: '0xpublic123',
          encryptedPrivateKey: 'encrypted-private-key'
        }
      });
    });

    it('should handle wallet creation failure', async () => {
      const mockResponse = {
        success: false,
        error: 'Invalid parameters'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      await expect(service.createWallet(mockParams)).rejects.toMatchObject({
        code: ChipiPayErrorCodes.WALLET_CREATION_FAILED,
        message: 'Invalid parameters'
      });
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.createWallet(mockParams)).rejects.toMatchObject({
        code: ChipiPayErrorCodes.WALLET_CREATION_FAILED,
        message: 'Network error'
      });
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ message: 'Invalid request' })
      } as Response);

      await expect(service.createWallet(mockParams)).rejects.toMatchObject({
        code: ChipiPayErrorCodes.WALLET_CREATION_FAILED,
        message: 'Invalid request'
      });
    });
  });

  describe('transfer', () => {
    const mockParams: TransferParams = {
      privateKey: 'private-key-123',
      recipient: '0xrecipient123',
      amount: '100',
      contractAddress: '0xcontract123',
      decimals: 18,
      bearerToken: 'bearer-token-123'
    };

    it('should successfully execute transfer', async () => {
      const mockResponse = {
        success: true,
        txHash: '0xtransfer123',
        data: { status: 'completed' }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await service.transfer(mockParams);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-api.chipipay.com/v1/wallet/transfer',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer bearer-token-123'
          },
          body: JSON.stringify({
            privateKey: 'private-key-123',
            recipient: '0xrecipient123',
            amount: '100',
            contractAddress: '0xcontract123',
            decimals: 18
          })
        })
      );

      expect(result).toEqual({
        success: true,
        txHash: '0xtransfer123',
        data: { status: 'completed' }
      });
    });

    it('should handle transfer failure', async () => {
      const mockResponse = {
        success: false,
        error: 'Insufficient balance'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      await expect(service.transfer(mockParams)).rejects.toMatchObject({
        code: ChipiPayErrorCodes.TRANSFER_FAILED,
        message: 'Insufficient balance'
      });
    });
  });

  describe('approve', () => {
    const mockParams: ApproveParams = {
      privateKey: 'private-key-123',
      contractAddress: '0xcontract123',
      spender: '0xspender123',
      amount: '1000',
      decimals: 18,
      bearerToken: 'bearer-token-123'
    };

    it('should successfully execute approve', async () => {
      const mockResponse = {
        success: true,
        txHash: '0xapprove123',
        data: { allowance: '1000' }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await service.approve(mockParams);

      expect(result).toEqual({
        success: true,
        txHash: '0xapprove123',
        data: { allowance: '1000' }
      });
    });

    it('should handle approve failure', async () => {
      const mockResponse = {
        success: false,
        error: 'Contract not found'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      await expect(service.approve(mockParams)).rejects.toMatchObject({
        code: ChipiPayErrorCodes.APPROVE_FAILED,
        message: 'Contract not found'
      });
    });
  });

  describe('stakeVesuUsdc', () => {
    const mockParams: StakeParams = {
      privateKey: 'private-key-123',
      amount: '500',
      receiverWallet: '0xreceiver123',
      bearerToken: 'bearer-token-123'
    };

    it('should successfully execute VESU staking', async () => {
      const mockResponse = {
        success: true,
        txHash: '0xstake123',
        data: { stakedAmount: '500' }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await service.stakeVesuUsdc(mockParams);

      expect(result).toEqual({
        success: true,
        txHash: '0xstake123',
        data: { stakedAmount: '500' }
      });
    });

    it('should handle staking failure', async () => {
      const mockResponse = {
        success: false,
        error: 'VESU protocol error'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      await expect(service.stakeVesuUsdc(mockParams)).rejects.toMatchObject({
        code: ChipiPayErrorCodes.STAKE_FAILED,
        message: 'VESU protocol error'
      });
    });
  });

  describe('withdrawVesuUsdc', () => {
    const mockParams: WithdrawParams = {
      privateKey: 'private-key-123',
      amount: '250',
      recipient: '0xrecipient123',
      bearerToken: 'bearer-token-123'
    };

    it('should successfully execute VESU withdrawal', async () => {
      const mockResponse = {
        success: true,
        txHash: '0xwithdraw123',
        data: { withdrawnAmount: '250' }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await service.withdrawVesuUsdc(mockParams);

      expect(result).toEqual({
        success: true,
        txHash: '0xwithdraw123',
        data: { withdrawnAmount: '250' }
      });
    });

    it('should handle withdrawal failure', async () => {
      const mockResponse = {
        success: false,
        error: 'Insufficient staked amount'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      await expect(service.withdrawVesuUsdc(mockParams)).rejects.toMatchObject({
        code: ChipiPayErrorCodes.WITHDRAW_FAILED,
        message: 'Insufficient staked amount'
      });
    });
  });

  describe('callAnyContract', () => {
    const mockParams: ContractCallParams = {
      privateKey: 'private-key-123',
      contractAddress: '0xcontract123',
      entrypoint: 'transfer',
      calldata: ['0xrecipient', '100'],
      bearerToken: 'bearer-token-123'
    };

    it('should successfully execute contract call', async () => {
      const mockResponse = {
        success: true,
        txHash: '0xcall123',
        data: { result: 'success' }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await service.callAnyContract(mockParams);

      expect(result).toEqual({
        success: true,
        txHash: '0xcall123',
        data: { result: 'success' }
      });
    });

    it('should handle contract call failure', async () => {
      const mockResponse = {
        success: false,
        error: 'Contract execution failed'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      await expect(service.callAnyContract(mockParams)).rejects.toMatchObject({
        code: ChipiPayErrorCodes.CONTRACT_CALL_FAILED,
        message: 'Contract execution failed'
      });
    });
  });

  describe('timeout handling', () => {
    it('should handle request timeout', async () => {
      // Mock AbortError which is thrown when request times out
      mockFetch.mockRejectedValueOnce(Object.assign(new Error('Request timeout'), { name: 'AbortError' }));

      const mockParams: CreateWalletParams = {
        encryptKey: 'test-pin-123',
        externalUserId: 'user-123',
        apiPublicKey: 'pk_test_123',
        bearerToken: 'bearer-token-123'
      };

      await expect(service.createWallet(mockParams)).rejects.toMatchObject({
        code: ChipiPayErrorCodes.WALLET_CREATION_FAILED,
        message: 'Request timeout'
      });
    }, 10000); // Increase timeout for this test
  });
});