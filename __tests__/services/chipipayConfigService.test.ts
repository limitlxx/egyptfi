// __tests__/services/chipipayConfigService.test.ts
import { ChipiPayConfigServiceImpl } from '../../services/chipipayConfigService';
import jwt from 'jsonwebtoken';

describe('ChipiPayConfigService', () => {
  let configService: ChipiPayConfigServiceImpl;
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    process.env = { ...originalEnv };
    
    // Set up test environment variables
    process.env.CHIPI_PUBLIC_KEY_TESTNET = 'pk_test_123456';
    process.env.CHIPI_SECRET_KEY_TESTNET = 'sk_test_secret';
    process.env.STARKNET_RPC_URL_TESTNET = 'https://starknet-sepolia.infura.io/v3/test';
    process.env.CHIPI_PUBLIC_KEY_MAINNET = 'pk_live_789012';
    process.env.CHIPI_SECRET_KEY_MAINNET = 'sk_live_secret';
    process.env.STARKNET_RPC_URL_MAINNET = 'https://starknet-mainnet.infura.io/v3/test';
    process.env.CHIPIPAY_URL = 'https://api.chipipay.com/v1';
    process.env.CHIPIPAY_JWKS_ENDPOINT = 'https://auth.example.com/.well-known/jwks.json';
    process.env.CHIPIPAY_TIMEOUT = '25000';

    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    configService = new ChipiPayConfigServiceImpl();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('constructor and configuration loading', () => {
    it('should load configuration from environment variables', () => {
      const config = configService.getConfig();
      
      expect(config.testnet.apiPublicKey).toBe('pk_test_123456');
      expect(config.testnet.apiSecretKey).toBe('sk_test_secret');
      expect(config.testnet.rpcUrl).toBe('https://starknet-sepolia.infura.io/v3/test');
      expect(config.mainnet.apiPublicKey).toBe('pk_live_789012');
      expect(config.mainnet.apiSecretKey).toBe('sk_live_secret');
      expect(config.mainnet.rpcUrl).toBe('https://starknet-mainnet.infura.io/v3/test');
      expect(config.backendUrl).toBe('https://api.chipipay.com/v1');
      expect(config.jwksEndpoint).toBe('https://auth.example.com/.well-known/jwks.json');
      expect(config.defaultTimeout).toBe(25000);
    });

    it('should use fallback environment variables', () => {
      // Clear specific env vars and set fallbacks
      delete process.env.CHIPI_PUBLIC_KEY_TESTNET;
      delete process.env.CHIPI_SECRET_KEY_TESTNET;
      delete process.env.STARKNET_RPC_URL_TESTNET;
      
      process.env.CHIPI_PUBLIC_KEY = 'pk_fallback_123';
      process.env.CHIPI_SECRET_KEY = 'sk_fallback_secret';
      process.env.NEXT_PUBLIC_RPC_URL = 'https://fallback-rpc.com';

      const fallbackService = new ChipiPayConfigServiceImpl();
      const config = fallbackService.getConfig();
      
      expect(config.testnet.apiPublicKey).toBe('pk_fallback_123');
      expect(config.testnet.apiSecretKey).toBe('sk_fallback_secret');
      expect(config.testnet.rpcUrl).toBe('https://fallback-rpc.com');
    });

    it('should use default values when environment variables are missing', () => {
      // Clear all environment variables
      process.env = { NODE_ENV: 'test' };
      
      const emptyService = new ChipiPayConfigServiceImpl();
      const config = emptyService.getConfig();
      
      expect(config.testnet.apiPublicKey).toBe('');
      expect(config.testnet.apiSecretKey).toBe('');
      expect(config.testnet.rpcUrl).toBe('');
      expect(config.backendUrl).toBe('https://api.chipipay.com/v1');
      expect(config.jwksEndpoint).toBe('');
      expect(config.defaultTimeout).toBe(30000);
    });
  });

  describe('getConfig', () => {
    it('should return complete configuration', () => {
      const config = configService.getConfig();
      
      expect(config).toHaveProperty('testnet');
      expect(config).toHaveProperty('mainnet');
      expect(config).toHaveProperty('backendUrl');
      expect(config).toHaveProperty('jwksEndpoint');
      expect(config).toHaveProperty('defaultTimeout');
    });
  });

  describe('getEnvironmentConfig', () => {
    it('should return testnet configuration', () => {
      const testnetConfig = configService.getEnvironmentConfig('testnet');
      
      expect(testnetConfig.apiPublicKey).toBe('pk_test_123456');
      expect(testnetConfig.apiSecretKey).toBe('sk_test_secret');
      expect(testnetConfig.rpcUrl).toBe('https://starknet-sepolia.infura.io/v3/test');
    });

    it('should return mainnet configuration', () => {
      const mainnetConfig = configService.getEnvironmentConfig('mainnet');
      
      expect(mainnetConfig.apiPublicKey).toBe('pk_live_789012');
      expect(mainnetConfig.apiSecretKey).toBe('sk_live_secret');
      expect(mainnetConfig.rpcUrl).toBe('https://starknet-mainnet.infura.io/v3/test');
    });

    it('should throw error for invalid environment', () => {
      expect(() => {
        configService.getEnvironmentConfig('invalid' as any);
      }).toThrow('Invalid environment: invalid. Must be \'testnet\' or \'mainnet\'');
    });
  });

  describe('generateBearerToken', () => {
    it('should generate valid JWT token for testnet', async () => {
      const merchantId = 'merchant-123';
      const token = await configService.generateBearerToken(merchantId, 'testnet');
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      // Decode and verify token structure
      const decoded = jwt.decode(token) as any;
      expect(decoded.merchantId).toBe(merchantId);
      expect(decoded.environment).toBe('testnet');
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      expect(decoded.iss).toBe('egyptfi-chipipay-integration');
      expect(decoded.aud).toBe('chipipay-api');
    });

    it('should generate valid JWT token for mainnet', async () => {
      const merchantId = 'merchant-456';
      const token = await configService.generateBearerToken(merchantId, 'mainnet');
      
      const decoded = jwt.decode(token) as any;
      expect(decoded.merchantId).toBe(merchantId);
      expect(decoded.environment).toBe('mainnet');
    });

    it('should generate tokens with 1 hour expiration', async () => {
      const beforeTime = Math.floor(Date.now() / 1000);
      const token = await configService.generateBearerToken('merchant-123', 'testnet');
      const afterTime = Math.floor(Date.now() / 1000);
      
      const decoded = jwt.decode(token) as any;
      const expectedExpiry = beforeTime + (60 * 60); // 1 hour
      
      expect(decoded.exp).toBeGreaterThanOrEqual(expectedExpiry - 1);
      expect(decoded.exp).toBeLessThanOrEqual(afterTime + (60 * 60) + 1);
    });

    it('should throw error for empty merchant ID', async () => {
      await expect(configService.generateBearerToken('', 'testnet'))
        .rejects.toThrow('Merchant ID is required for token generation');
    });

    it('should handle token generation errors', async () => {
      // Mock jwt.sign to throw an error
      const originalSign = jwt.sign;
      jwt.sign = jest.fn().mockImplementation(() => {
        throw new Error('JWT signing failed');
      });

      try {
        await expect(configService.generateBearerToken('merchant-123', 'testnet'))
          .rejects.toThrow('Token generation failed: Error: JWT signing failed');
      } finally {
        jwt.sign = originalSign;
      }
    });
  });

  describe('validateConfiguration', () => {
    it('should return no errors for valid configuration', () => {
      const errors = configService.validateConfiguration();
      expect(errors).toHaveLength(0);
    });

    it('should return errors for missing testnet configuration', () => {
      process.env.CHIPI_PUBLIC_KEY_TESTNET = '';
      process.env.CHIPI_SECRET_KEY_TESTNET = '';
      process.env.STARKNET_RPC_URL_TESTNET = '';
      
      const invalidService = new ChipiPayConfigServiceImpl();
      const errors = invalidService.validateConfiguration();
      
      expect(errors).toContainEqual({
        field: 'CHIPI_PUBLIC_KEY_TESTNET',
        message: 'Testnet API public key is required'
      });
      expect(errors).toContainEqual({
        field: 'CHIPI_SECRET_KEY_TESTNET',
        message: 'Testnet API secret key is required'
      });
      expect(errors).toContainEqual({
        field: 'STARKNET_RPC_URL_TESTNET',
        message: 'Testnet RPC URL is required'
      });
    });

    it('should return errors for missing mainnet configuration', () => {
      process.env.CHIPI_PUBLIC_KEY_MAINNET = '';
      process.env.CHIPI_SECRET_KEY_MAINNET = '';
      process.env.STARKNET_RPC_URL_MAINNET = '';
      
      const invalidService = new ChipiPayConfigServiceImpl();
      const errors = invalidService.validateConfiguration();
      
      expect(errors).toContainEqual({
        field: 'CHIPI_PUBLIC_KEY_MAINNET',
        message: 'Mainnet API public key is required'
      });
      expect(errors).toContainEqual({
        field: 'CHIPI_SECRET_KEY_MAINNET',
        message: 'Mainnet API secret key is required'
      });
      expect(errors).toContainEqual({
        field: 'STARKNET_RPC_URL_MAINNET',
        message: 'Mainnet RPC URL is required'
      });
    });

    it('should return errors for missing common configuration', () => {
      process.env.CHIPIPAY_JWKS_ENDPOINT = '';
      
      const invalidService = new ChipiPayConfigServiceImpl();
      const errors = invalidService.validateConfiguration();
      
      expect(errors).toContainEqual({
        field: 'CHIPIPAY_JWKS_ENDPOINT',
        message: 'JWKS endpoint is required for token validation'
      });
    });
  });

  describe('isConfigurationValid', () => {
    it('should return true for valid configuration', () => {
      expect(configService.isConfigurationValid()).toBe(true);
    });

    it('should return false for invalid configuration', () => {
      process.env.CHIPI_PUBLIC_KEY_TESTNET = '';
      
      const invalidService = new ChipiPayConfigServiceImpl();
      expect(invalidService.isConfigurationValid()).toBe(false);
    });
  });

  describe('reloadConfiguration', () => {
    it('should reload configuration from environment', () => {
      // Change environment variable
      process.env.CHIPIPAY_URL = 'https://new-api.chipipay.com/v1';
      
      configService.reloadConfiguration();
      const config = configService.getConfig();
      
      expect(config.backendUrl).toBe('https://new-api.chipipay.com/v1');
    });

    it('should update validation errors after reload', () => {
      // Initially valid
      expect(configService.isConfigurationValid()).toBe(true);
      
      // Make configuration invalid
      process.env.CHIPI_PUBLIC_KEY_TESTNET = '';
      configService.reloadConfiguration();
      
      expect(configService.isConfigurationValid()).toBe(false);
    });
  });

  describe('getConfigurationSummary', () => {
    it('should return configuration summary with masked secrets', () => {
      const summary = configService.getConfigurationSummary();
      
      expect(summary.backendUrl).toBe('https://api.chipipay.com/v1');
      expect(summary.jwksEndpoint).toBe('***configured***');
      expect(summary.defaultTimeout).toBe(25000);
      expect(summary.testnet.apiPublicKey).toBe('***configured***');
      expect(summary.testnet.apiSecretKey).toBe('***configured***');
      expect(summary.testnet.rpcUrl).toBe('https://starknet-sepolia.infura.io/v3/test');
      expect(summary.mainnet.apiPublicKey).toBe('***configured***');
      expect(summary.mainnet.apiSecretKey).toBe('***configured***');
      expect(summary.validationErrors).toBe(0);
      expect(summary.isValid).toBe(true);
    });

    it('should show missing configuration in summary', () => {
      process.env.CHIPI_PUBLIC_KEY_TESTNET = '';
      process.env.CHIPIPAY_JWKS_ENDPOINT = '';
      
      const invalidService = new ChipiPayConfigServiceImpl();
      const summary = invalidService.getConfigurationSummary();
      
      expect(summary.testnet.apiPublicKey).toBe('missing');
      expect(summary.jwksEndpoint).toBe('missing');
      expect(summary.validationErrors).toBeGreaterThan(0);
      expect(summary.isValid).toBe(false);
    });
  });

  describe('validateBearerToken', () => {
    it('should validate correct token for testnet', async () => {
      const merchantId = 'merchant-validate-test';
      const token = await configService.generateBearerToken(merchantId, 'testnet');
      
      const result = await configService.validateBearerToken(token, 'testnet');
      
      expect(result.merchantId).toBe(merchantId);
      expect(result.environment).toBe('testnet');
      expect(result.iat).toBeDefined();
      expect(result.exp).toBeDefined();
    });

    it('should validate correct token for mainnet', async () => {
      const merchantId = 'merchant-validate-mainnet';
      const token = await configService.generateBearerToken(merchantId, 'mainnet');
      
      const result = await configService.validateBearerToken(token, 'mainnet');
      
      expect(result.merchantId).toBe(merchantId);
      expect(result.environment).toBe('mainnet');
    });

    it('should reject token with wrong environment', async () => {
      const token = await configService.generateBearerToken('merchant-123', 'testnet');
      
      await expect(configService.validateBearerToken(token, 'mainnet'))
        .rejects.toThrow('Token validation failed');
    });

    it('should reject invalid token', async () => {
      await expect(configService.validateBearerToken('invalid-token', 'testnet'))
        .rejects.toThrow('Token validation failed');
    });

    it('should reject token signed with wrong secret', async () => {
      const wrongToken = jwt.sign(
        { merchantId: 'test', environment: 'testnet' },
        'wrong-secret'
      );
      
      await expect(configService.validateBearerToken(wrongToken, 'testnet'))
        .rejects.toThrow('Token validation failed');
    });

    it('should reject expired token', async () => {
      const expiredToken = jwt.sign(
        {
          merchantId: 'test',
          environment: 'testnet',
          iat: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
          exp: Math.floor(Date.now() / 1000) - 1800  // 30 minutes ago (expired)
        },
        configService.getEnvironmentConfig('testnet').apiSecretKey
      );
      
      await expect(configService.validateBearerToken(expiredToken, 'testnet'))
        .rejects.toThrow('Token validation failed');
    });
  });

  describe('error handling and logging', () => {
    it('should log operations', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      await configService.generateBearerToken('merchant-log-test', 'testnet');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[ChipiPayConfig] generateBearerToken:',
        expect.objectContaining({
          timestamp: expect.any(String),
          operation: 'generateBearerToken',
          merchantId: 'merchant-log-test',
          environment: 'testnet',
          tokenExpiry: expect.any(String)
        })
      );
    });

    it('should log errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error');
      
      try {
        await configService.generateBearerToken('', 'testnet');
      } catch (error) {
        // Expected to throw
      }
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ChipiPayConfig] generateBearerToken failed:',
        expect.objectContaining({
          timestamp: expect.any(String),
          operation: 'generateBearerToken',
          error: expect.any(String),
          context: '',
          stack: expect.any(String)
        })
      );
    });

    it('should log reload operations', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      configService.reloadConfiguration();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[ChipiPayConfig] reloadConfiguration:',
        expect.objectContaining({
          timestamp: expect.any(String),
          operation: 'reloadConfiguration',
          validationErrors: expect.any(Number),
          isValid: expect.any(Boolean)
        })
      );
    });
  });
});