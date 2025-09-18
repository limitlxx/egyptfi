import jwt from 'jsonwebtoken';
import { ChipiPayConfigServiceImpl } from '../../services/chipipayConfigService';
import { ConfigValidationError } from '../../services/types/config.types';

// Mock jwt
jest.mock('jsonwebtoken');
const mockJwt = jwt as jest.Mocked<typeof jwt>;

describe('ChipiPayConfigService', () => {
  let service: ChipiPayConfigServiceImpl;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Clear ChipiPay-related environment variables for clean tests
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('CHIPI') || key.startsWith('CHIPIPAY') || key.startsWith('STARKNET') || key.startsWith('NEXT_PUBLIC_RPC')) {
        delete process.env[key];
      }
    });
    
    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('configuration loading', () => {
    it('should load configuration from environment variables', () => {
      process.env.CHIPI_PUBLIC_KEY = 'pk_test_123';
      process.env.CHIPI_SECRET_KEY = 'sk_test_123';
      process.env.CHIPIPAY_URL = 'https://test-api.chipipay.com/v1';
      process.env.CHIPIPAY_JWKS_ENDPOINT = 'https://auth.test.com/.well-known/jwks.json';
      process.env.NEXT_PUBLIC_RPC_URL = 'https://testnet-rpc.starknet.io';
      process.env.STARKNET_RPC_URL = 'https://mainnet-rpc.starknet.io';

      service = new ChipiPayConfigServiceImpl();
      const config = service.getConfig();

      expect(config).toEqual({
        testnet: {
          apiPublicKey: 'pk_test_123',
          apiSecretKey: 'sk_test_123',
          rpcUrl: 'https://testnet-rpc.starknet.io'
        },
        mainnet: {
          apiPublicKey: 'pk_test_123',
          apiSecretKey: 'sk_test_123',
          rpcUrl: 'https://mainnet-rpc.starknet.io'
        },
        backendUrl: 'https://test-api.chipipay.com/v1',
        jwksEndpoint: 'https://auth.test.com/.well-known/jwks.json',
        defaultTimeout: 30000
      });
    });

    it('should use environment-specific keys when available', () => {
      process.env.CHIPI_PUBLIC_KEY_TESTNET = 'pk_testnet_123';
      process.env.CHIPI_SECRET_KEY_TESTNET = 'sk_testnet_123';
      process.env.CHIPI_PUBLIC_KEY_MAINNET = 'pk_mainnet_123';
      process.env.CHIPI_SECRET_KEY_MAINNET = 'sk_mainnet_123';
      process.env.STARKNET_RPC_URL_TESTNET = 'https://testnet-specific.starknet.io';
      process.env.STARKNET_RPC_URL_MAINNET = 'https://mainnet-specific.starknet.io';

      service = new ChipiPayConfigServiceImpl();
      const config = service.getConfig();

      expect(config.testnet.apiPublicKey).toBe('pk_testnet_123');
      expect(config.testnet.apiSecretKey).toBe('sk_testnet_123');
      expect(config.mainnet.apiPublicKey).toBe('pk_mainnet_123');
      expect(config.mainnet.apiSecretKey).toBe('sk_mainnet_123');
      expect(config.testnet.rpcUrl).toBe('https://testnet-specific.starknet.io');
      expect(config.mainnet.rpcUrl).toBe('https://mainnet-specific.starknet.io');
    });

    it('should use default values when environment variables are missing', () => {
      // Clear all relevant environment variables
      delete process.env.CHIPI_PUBLIC_KEY;
      delete process.env.CHIPI_SECRET_KEY;
      delete process.env.CHIPIPAY_URL;
      delete process.env.CHIPIPAY_JWKS_ENDPOINT;

      service = new ChipiPayConfigServiceImpl();
      const config = service.getConfig();

      expect(config.backendUrl).toBe('https://api.chipipay.com/v1');
      expect(config.defaultTimeout).toBe(30000);
      expect(config.testnet.apiPublicKey).toBe('');
      expect(config.testnet.apiSecretKey).toBe('');
    });
  });

  describe('environment configuration', () => {
    beforeEach(() => {
      process.env.CHIPI_PUBLIC_KEY_TESTNET = 'pk_testnet_123';
      process.env.CHIPI_SECRET_KEY_TESTNET = 'sk_testnet_123';
      process.env.CHIPI_PUBLIC_KEY_MAINNET = 'pk_mainnet_123';
      process.env.CHIPI_SECRET_KEY_MAINNET = 'sk_mainnet_123';
      
      service = new ChipiPayConfigServiceImpl();
    });

    it('should return testnet configuration', () => {
      const testnetConfig = service.getEnvironmentConfig('testnet');
      
      expect(testnetConfig).toEqual({
        apiPublicKey: 'pk_testnet_123',
        apiSecretKey: 'sk_testnet_123',
        rpcUrl: ''
      });
    });

    it('should return mainnet configuration', () => {
      const mainnetConfig = service.getEnvironmentConfig('mainnet');
      
      expect(mainnetConfig).toEqual({
        apiPublicKey: 'pk_mainnet_123',
        apiSecretKey: 'sk_mainnet_123',
        rpcUrl: ''
      });
    });

    it('should throw error for invalid environment', () => {
      expect(() => {
        service.getEnvironmentConfig('invalid' as any);
      }).toThrow("Invalid environment: invalid. Must be 'testnet' or 'mainnet'");
    });
  });

  describe('configuration validation', () => {
    it('should validate complete configuration successfully', () => {
      process.env.CHIPI_PUBLIC_KEY_TESTNET = 'pk_testnet_123';
      process.env.CHIPI_SECRET_KEY_TESTNET = 'sk_testnet_123';
      process.env.CHIPI_PUBLIC_KEY_MAINNET = 'pk_mainnet_123';
      process.env.CHIPI_SECRET_KEY_MAINNET = 'sk_mainnet_123';
      process.env.STARKNET_RPC_URL_TESTNET = 'https://testnet.starknet.io';
      process.env.STARKNET_RPC_URL_MAINNET = 'https://mainnet.starknet.io';
      process.env.CHIPIPAY_URL = 'https://api.chipipay.com/v1';
      process.env.CHIPIPAY_JWKS_ENDPOINT = 'https://auth.chipipay.com/.well-known/jwks.json';

      service = new ChipiPayConfigServiceImpl();
      
      expect(service.isConfigurationValid()).toBe(true);
      expect(service.validateConfiguration()).toEqual([]);
    });

    it('should identify missing configuration fields', () => {
      // Clear all environment variables
      Object.keys(process.env).forEach(key => {
        if (key.startsWith('CHIPI') || key.startsWith('STARKNET') || key.startsWith('CHIPIPAY')) {
          delete process.env[key];
        }
      });

      service = new ChipiPayConfigServiceImpl();
      const errors = service.validateConfiguration();

      expect(service.isConfigurationValid()).toBe(false);
      expect(errors).toHaveLength(7); // 6 API keys + 2 RPC URLs + 1 JWKS (backend URL has default)

      const errorFields = errors.map(e => e.field);
      expect(errorFields).toContain('CHIPI_PUBLIC_KEY_TESTNET');
      expect(errorFields).toContain('CHIPI_SECRET_KEY_TESTNET');
      expect(errorFields).toContain('CHIPI_PUBLIC_KEY_MAINNET');
      expect(errorFields).toContain('CHIPI_SECRET_KEY_MAINNET');
      expect(errorFields).toContain('STARKNET_RPC_URL_TESTNET');
      expect(errorFields).toContain('STARKNET_RPC_URL_MAINNET');
      expect(errorFields).toContain('CHIPIPAY_JWKS_ENDPOINT');
    });

    it('should provide meaningful error messages', () => {
      service = new ChipiPayConfigServiceImpl();
      const errors = service.validateConfiguration();

      const testnetKeyError = errors.find(e => e.field === 'CHIPI_PUBLIC_KEY_TESTNET');
      expect(testnetKeyError?.message).toBe('Testnet API public key is required');

      const jwksError = errors.find(e => e.field === 'CHIPIPAY_JWKS_ENDPOINT');
      expect(jwksError?.message).toBe('JWKS endpoint is required for token validation');
    });
  });

  describe('bearer token generation', () => {
    beforeEach(() => {
      process.env.CHIPI_SECRET_KEY_TESTNET = 'sk_testnet_secret';
      process.env.CHIPI_SECRET_KEY_MAINNET = 'sk_mainnet_secret';
      
      service = new ChipiPayConfigServiceImpl();
    });

    it('should generate bearer token for testnet', async () => {
      const mockToken = 'mock.jwt.token';
      mockJwt.sign.mockReturnValue(mockToken);

      const token = await service.generateBearerToken('merchant-123', 'testnet');

      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          merchantId: 'merchant-123',
          environment: 'testnet',
          iat: expect.any(Number),
          exp: expect.any(Number)
        }),
        'sk_testnet_secret',
        expect.objectContaining({
          algorithm: 'HS256',
          issuer: 'egyptfi-chipipay-integration',
          audience: 'chipipay-api'
        })
      );

      expect(token).toBe(mockToken);
    });

    it('should generate bearer token for mainnet', async () => {
      const mockToken = 'mock.jwt.token';
      mockJwt.sign.mockReturnValue(mockToken);

      const token = await service.generateBearerToken('merchant-456', 'mainnet');

      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          merchantId: 'merchant-456',
          environment: 'mainnet'
        }),
        'sk_mainnet_secret',
        expect.any(Object)
      );

      expect(token).toBe(mockToken);
    });

    it('should throw error for missing merchant ID', async () => {
      await expect(service.generateBearerToken('', 'testnet')).rejects.toThrow(
        'Token generation failed: Merchant ID is required for token generation'
      );
    });

    it('should handle JWT signing errors', async () => {
      mockJwt.sign.mockImplementation(() => {
        throw new Error('JWT signing failed');
      });

      await expect(service.generateBearerToken('merchant-123', 'testnet')).rejects.toThrow(
        'Token generation failed: JWT signing failed'
      );
    });
  });

  describe('bearer token validation', () => {
    beforeEach(() => {
      process.env.CHIPI_SECRET_KEY_TESTNET = 'sk_testnet_secret';
      process.env.CHIPI_SECRET_KEY_MAINNET = 'sk_mainnet_secret';
      
      service = new ChipiPayConfigServiceImpl();
    });

    it('should validate bearer token successfully', async () => {
      const mockPayload = {
        merchantId: 'merchant-123',
        environment: 'testnet' as const,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      mockJwt.verify.mockReturnValue(mockPayload);

      const result = await service.validateBearerToken('valid.jwt.token', 'testnet');

      expect(mockJwt.verify).toHaveBeenCalledWith(
        'valid.jwt.token',
        'sk_testnet_secret',
        expect.objectContaining({
          algorithms: ['HS256'],
          issuer: 'egyptfi-chipipay-integration',
          audience: 'chipipay-api'
        })
      );

      expect(result).toEqual(mockPayload);
    });

    it('should reject token with environment mismatch', async () => {
      const mockPayload = {
        merchantId: 'merchant-123',
        environment: 'mainnet' as const,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      mockJwt.verify.mockReturnValue(mockPayload);

      await expect(service.validateBearerToken('token', 'testnet')).rejects.toThrow(
        'Token validation failed: Token environment mismatch: expected testnet, got mainnet'
      );
    });

    it('should handle JWT verification errors', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.validateBearerToken('invalid.token', 'testnet')).rejects.toThrow(
        'Token validation failed: Invalid token'
      );
    });
  });

  describe('configuration reload', () => {
    it('should reload configuration from updated environment', () => {
      process.env.CHIPI_PUBLIC_KEY = 'pk_initial_123';
      service = new ChipiPayConfigServiceImpl();
      
      let config = service.getConfig();
      expect(config.testnet.apiPublicKey).toBe('pk_initial_123');

      // Update environment
      process.env.CHIPI_PUBLIC_KEY = 'pk_updated_456';
      service.reloadConfiguration();

      config = service.getConfig();
      expect(config.testnet.apiPublicKey).toBe('pk_updated_456');
    });
  });

  describe('configuration summary', () => {
    it('should provide configuration summary without exposing secrets', () => {
      process.env.CHIPI_PUBLIC_KEY = 'pk_test_123';
      process.env.CHIPI_SECRET_KEY = 'sk_test_secret';
      process.env.CHIPIPAY_JWKS_ENDPOINT = 'https://auth.test.com/.well-known/jwks.json';
      
      service = new ChipiPayConfigServiceImpl();
      const summary = service.getConfigurationSummary();

      expect(summary.testnet.apiPublicKey).toBe('***configured***');
      expect(summary.testnet.apiSecretKey).toBe('***configured***');
      expect(summary.jwksEndpoint).toBe('***configured***');
      expect(summary.backendUrl).toBe('https://api.chipipay.com/v1');
      expect(summary.isValid).toBe(false); // Missing some required fields
    });

    it('should indicate missing configuration fields', () => {
      service = new ChipiPayConfigServiceImpl();
      const summary = service.getConfigurationSummary();

      expect(summary.testnet.apiPublicKey).toBe('missing');
      expect(summary.testnet.apiSecretKey).toBe('missing');
      expect(summary.jwksEndpoint).toBe('missing');
    });
  });
});