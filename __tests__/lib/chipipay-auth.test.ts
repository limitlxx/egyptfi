// __tests__/lib/chipipay-auth.test.ts
import { ChipiPayAuth } from '../../lib/chipipay-auth';
import { chipipayConfigService } from '../../services/chipipayConfigService';
import jwt from 'jsonwebtoken';

// Mock the ChipiPayConfigService
jest.mock('../../services/chipipayConfigService', () => ({
  chipipayConfigService: {
    getConfig: jest.fn(),
    getEnvironmentConfig: jest.fn(),
  }
}));

const mockConfigService = chipipayConfigService as jest.Mocked<typeof chipipayConfigService>;

describe('ChipiPayAuth', () => {
  const merchantId = 'merchant-123';
  const testnetEnvConfig = {
    apiPublicKey: 'pk_test_123456',
    apiSecretKey: 'sk_test_secret',
    rpcUrl: 'https://starknet-sepolia.infura.io/v3/test'
  };

  const mainConfig = {
    testnet: testnetEnvConfig,
    mainnet: {
      apiPublicKey: 'pk_live_789012',
      apiSecretKey: 'sk_live_secret',
      rpcUrl: 'https://starknet-mainnet.infura.io/v3/test'
    },
    backendUrl: 'https://api.chipipay.com/v1',
    jwksEndpoint: 'https://auth.example.com/.well-known/jwks.json',
    defaultTimeout: 30000
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Clear token cache before each test
    const tokenCache = ChipiPayAuth.getTokenCache();
    tokenCache.clear();

    // Mock environment variable
    process.env.CHIPIPAY_JWT_SECRET = 'test-secret-key';
  });

  afterEach(() => {
    delete process.env.CHIPIPAY_JWT_SECRET;
    // Clean up any intervals
    ChipiPayAuth.cleanup();
  });

  afterAll(() => {
    // Ensure cleanup on test completion
    ChipiPayAuth.cleanup();
  });

  describe('getBearerToken', () => {
    it('should generate new token for testnet', async () => {
      mockConfigService.getEnvironmentConfig.mockReturnValue(testnetEnvConfig);
      mockConfigService.getConfig.mockReturnValue(mainConfig);

      const result = await ChipiPayAuth.getBearerToken(merchantId, 'testnet');
      
      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeDefined();
      
      // Verify token structure
      const decoded = jwt.decode(result.token!) as any;
      expect(decoded.sub).toBe(merchantId);
      expect(decoded.environment).toBe('testnet');
      expect(decoded.api_public_key).toBe(testnetEnvConfig.apiPublicKey);
    });

    it('should generate new token for mainnet', async () => {
      const mainnetEnvConfig = mainConfig.mainnet;
      
      mockConfigService.getEnvironmentConfig.mockReturnValue(mainnetEnvConfig);
      mockConfigService.getConfig.mockReturnValue(mainConfig);

      const result = await ChipiPayAuth.getBearerToken(merchantId, 'mainnet');
      
      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      
      const decoded = jwt.decode(result.token!) as any;
      expect(decoded.environment).toBe('mainnet');
      expect(decoded.api_public_key).toBe(mainnetEnvConfig.apiPublicKey);
    });

    it('should return cached token if still valid', async () => {
      mockConfigService.getEnvironmentConfig.mockReturnValue(testnetEnvConfig);
      mockConfigService.getConfig.mockReturnValue(mainConfig);

      // First call
      const result1 = await ChipiPayAuth.getBearerToken(merchantId, 'testnet');
      expect(result1.success).toBe(true);

      // Second call should return cached token
      const result2 = await ChipiPayAuth.getBearerToken(merchantId, 'testnet');
      expect(result2.success).toBe(true);
      expect(result2.token).toBe(result1.token);
      
      // Should only call getEnvironmentConfig once (for first call)
      expect(mockConfigService.getEnvironmentConfig).toHaveBeenCalledTimes(1);
    });

    it('should return error if config not found', async () => {
      mockConfigService.getEnvironmentConfig.mockReturnValue(null as any);

      const result = await ChipiPayAuth.getBearerToken(merchantId, 'testnet');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('ChipiPay configuration not found for testnet');
    });

    it('should return error if JWKS endpoint not configured', async () => {
      const configWithoutJwks = {
        ...mainConfig,
        jwksEndpoint: ''
      };
      
      mockConfigService.getEnvironmentConfig.mockReturnValue(testnetEnvConfig);
      mockConfigService.getConfig.mockReturnValue(configWithoutJwks);

      const result = await ChipiPayAuth.getBearerToken(merchantId, 'testnet');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('JWKS endpoint not configured');
    });

    it('should handle token generation errors', async () => {
      mockConfigService.getEnvironmentConfig.mockImplementation(() => {
        throw new Error('Config error');
      });

      const result = await ChipiPayAuth.getBearerToken(merchantId, 'testnet');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to generate bearer token');
    });
  });

  describe('refreshTokenIfNeeded', () => {
    it('should return existing token if not close to expiry', async () => {
      mockConfigService.getEnvironmentConfig.mockReturnValue(testnetEnvConfig);
      mockConfigService.getConfig.mockReturnValue(mainConfig);

      // Get initial token
      const initialResult = await ChipiPayAuth.getBearerToken(merchantId, 'testnet');
      expect(initialResult.success).toBe(true);

      // Refresh should return same token
      const refreshResult = await ChipiPayAuth.refreshTokenIfNeeded(merchantId, 'testnet');
      expect(refreshResult.success).toBe(true);
      expect(refreshResult.token).toBe(initialResult.token);
    });

    it('should generate new token if close to expiry', async () => {
      mockConfigService.getEnvironmentConfig.mockReturnValue(testnetEnvConfig);
      mockConfigService.getConfig.mockReturnValue(mainConfig);

      // Manually set a token that's close to expiry
      const tokenCache = ChipiPayAuth.getTokenCache();
      const cacheKey = `${merchantId}_testnet`;
      const expiringSoon = Date.now() + (2 * 60 * 1000); // 2 minutes from now
      
      tokenCache.set(cacheKey, {
        token: 'expiring-token',
        expiresAt: expiringSoon,
        merchantId
      });

      const result = await ChipiPayAuth.refreshTokenIfNeeded(merchantId, 'testnet');
      
      expect(result.success).toBe(true);
      expect(result.token).not.toBe('expiring-token'); // Should be a new token
    });

    it('should generate token if none exists', async () => {
      mockConfigService.getEnvironmentConfig.mockReturnValue(testnetEnvConfig);
      mockConfigService.getConfig.mockReturnValue(mainConfig);

      const result = await ChipiPayAuth.refreshTokenIfNeeded(merchantId, 'testnet');
      
      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
    });
  });

  describe('invalidateToken', () => {
    it('should remove token from cache', async () => {
      const testMerchantId = 'merchant-invalidate-test';
      mockConfigService.getEnvironmentConfig.mockReturnValue(testnetEnvConfig);
      mockConfigService.getConfig.mockReturnValue(mainConfig);

      // Mock Date.now to return different values
      const originalDateNow = Date.now;
      let mockTime = 1000000000000; // Fixed timestamp
      Date.now = jest.fn(() => mockTime);

      try {
        // Get token first
        const result1 = await ChipiPayAuth.getBearerToken(testMerchantId, 'testnet');
        expect(result1.success).toBe(true);

        // Verify token is cached
        const cache = ChipiPayAuth.getTokenCache();
        const cacheKey = `${testMerchantId}_testnet`;
        expect(cache.has(cacheKey)).toBe(true);

        // Invalidate token
        ChipiPayAuth.invalidateToken(testMerchantId, 'testnet');

        // Verify token is removed from cache
        expect(cache.has(cacheKey)).toBe(false);

        // Advance time to ensure different timestamp
        mockTime += 1000; // 1 second later

        // Next call should generate new token
        const result2 = await ChipiPayAuth.getBearerToken(testMerchantId, 'testnet');
        expect(result2.success).toBe(true);
        expect(result2.token).not.toBe(result1.token);
      } finally {
        // Restore original Date.now
        Date.now = originalDateNow;
      }
    });
  });

  describe('validateToken', () => {
    it('should validate correct token', async () => {
      mockConfigService.getEnvironmentConfig.mockReturnValue(testnetEnvConfig);
      mockConfigService.getConfig.mockReturnValue(mainConfig);

      const tokenResult = await ChipiPayAuth.getBearerToken(merchantId, 'testnet');
      expect(tokenResult.success).toBe(true);

      const validation = ChipiPayAuth.validateToken(tokenResult.token!);
      
      expect(validation.valid).toBe(true);
      expect(validation.payload).toBeDefined();
      expect((validation.payload as any).sub).toBe(merchantId);
    });

    it('should reject invalid token', () => {
      const validation = ChipiPayAuth.validateToken('invalid-token');
      
      expect(validation.valid).toBe(false);
      expect(validation.error).toBeDefined();
    });

    it('should reject token with wrong secret', () => {
      const wrongToken = jwt.sign({ sub: merchantId }, 'wrong-secret');
      const validation = ChipiPayAuth.validateToken(wrongToken);
      
      expect(validation.valid).toBe(false);
      expect(validation.error).toBeDefined();
    });
  });

  describe('getTokenInfo', () => {
    it('should decode token without validation', async () => {
      mockConfigService.getEnvironmentConfig.mockReturnValue(testnetEnvConfig);
      mockConfigService.getConfig.mockReturnValue(mainConfig);

      const tokenResult = await ChipiPayAuth.getBearerToken(merchantId, 'testnet');
      expect(tokenResult.success).toBe(true);

      const info = ChipiPayAuth.getTokenInfo(tokenResult.token!);
      
      expect(info.payload).toBeDefined();
      expect((info.payload as any).sub).toBe(merchantId);
      expect((info.payload as any).environment).toBe('testnet');
    });

    it('should handle invalid token format', () => {
      const info = ChipiPayAuth.getTokenInfo('invalid-token');
      
      expect(info.error).toBeDefined();
    });
  });

  describe('token expiry and cleanup', () => {
    it('should generate tokens with correct expiry time', async () => {
      mockConfigService.getEnvironmentConfig.mockReturnValue(testnetEnvConfig);
      mockConfigService.getConfig.mockReturnValue(mainConfig);

      const beforeTime = Date.now();
      const result = await ChipiPayAuth.getBearerToken(merchantId, 'testnet');
      const afterTime = Date.now();
      
      expect(result.success).toBe(true);
      expect(result.expiresAt).toBeDefined();
      
      // Token should expire in approximately 55 minutes
      const expectedExpiry = beforeTime + (55 * 60 * 1000);
      const actualExpiry = result.expiresAt!;
      
      expect(actualExpiry).toBeGreaterThanOrEqual(expectedExpiry - 1000); // Allow 1 second tolerance
      expect(actualExpiry).toBeLessThanOrEqual(afterTime + (55 * 60 * 1000) + 1000);
    });

    it('should include correct JWT claims', async () => {
      mockConfigService.getEnvironmentConfig.mockReturnValue(testnetEnvConfig);
      mockConfigService.getConfig.mockReturnValue(mainConfig);

      const result = await ChipiPayAuth.getBearerToken(merchantId, 'testnet');
      expect(result.success).toBe(true);

      const decoded = jwt.decode(result.token!) as any;
      
      expect(decoded.iss).toBe('egyptfi-merchant-platform');
      expect(decoded.sub).toBe(merchantId);
      expect(decoded.aud).toBe('chipipay-api');
      expect(decoded.environment).toBe('testnet');
      expect(decoded.api_public_key).toBe(testnetEnvConfig.apiPublicKey);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });
  });
});