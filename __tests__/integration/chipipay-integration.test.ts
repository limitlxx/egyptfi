import { ChipiPayServiceImpl } from '../../services/chipipayService';
import { ChipiPayConfigServiceImpl } from '../../services/chipipayConfigService';

describe('ChipiPay Integration', () => {
  let configService: ChipiPayConfigServiceImpl;
  let chipipayService: ChipiPayServiceImpl;

  beforeEach(() => {
    // Set up test environment
    process.env.CHIPI_PUBLIC_KEY_TESTNET = 'pk_test_integration';
    process.env.CHIPI_SECRET_KEY_TESTNET = 'sk_test_integration';
    process.env.STARKNET_RPC_URL_TESTNET = 'https://testnet.starknet.io';
    process.env.CHIPIPAY_URL = 'https://test-api.chipipay.com/v1';
    process.env.CHIPIPAY_JWKS_ENDPOINT = 'https://auth.test.com/.well-known/jwks.json';

    configService = new ChipiPayConfigServiceImpl();
    chipipayService = new ChipiPayServiceImpl(configService.getConfig().backendUrl);

    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should integrate configuration service with ChipiPay service', async () => {
    // Test that configuration service provides correct config
    const config = configService.getConfig();
    expect(config.backendUrl).toBe('https://test-api.chipipay.com/v1');
    expect(config.testnet.apiPublicKey).toBe('pk_test_integration');

    // Test that ChipiPay service can use the configuration
    expect(chipipayService).toBeDefined();
    
    // Verify configuration is valid for integration
    expect(configService.isConfigurationValid()).toBe(true);
  });

  it('should generate bearer token for ChipiPay service operations', async () => {
    // Mock JWT signing
    const jwt = require('jsonwebtoken');
    jest.spyOn(jwt, 'sign').mockReturnValue('mock.bearer.token');

    const bearerToken = await configService.generateBearerToken('merchant-123', 'testnet');
    
    expect(bearerToken).toBe('mock.bearer.token');
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: 'merchant-123',
        environment: 'testnet'
      }),
      'sk_test_integration',
      expect.any(Object)
    );
  });

  it('should handle configuration errors gracefully', () => {
    // Clear required environment variables
    delete process.env.CHIPIPAY_JWKS_ENDPOINT;
    
    const invalidConfigService = new ChipiPayConfigServiceImpl();
    
    expect(invalidConfigService.isConfigurationValid()).toBe(false);
    
    const errors = invalidConfigService.validateConfiguration();
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('CHIPIPAY_JWKS_ENDPOINT');
  });
});