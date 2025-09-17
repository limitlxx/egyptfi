import jwt from 'jsonwebtoken';
import {
  ChipiPayConfigService,
  ChipiPayConfig,
  ChipiPayEnvironmentConfig,
  BearerTokenPayload,
  ConfigValidationError,
  ConfigErrorCodes
} from './types/config.types';

export class ChipiPayConfigServiceImpl implements ChipiPayConfigService {
  private config: ChipiPayConfig;
  private validationErrors: ConfigValidationError[] = [];

  constructor() {
    this.config = this.loadConfiguration();
    this.validationErrors = this.validateConfiguration();
    
    if (this.validationErrors.length > 0) {
      console.warn('[ChipiPayConfig] Configuration validation warnings:', this.validationErrors);
    }
  }

  /**
   * Get the complete ChipiPay configuration
   */
  getConfig(): ChipiPayConfig {
    return this.config;
  }

  /**
   * Get environment-specific configuration
   */
  getEnvironmentConfig(environment: 'testnet' | 'mainnet'): ChipiPayEnvironmentConfig {
    if (environment !== 'testnet' && environment !== 'mainnet') {
      throw new Error(`Invalid environment: ${environment}. Must be 'testnet' or 'mainnet'`);
    }
    
    return this.config[environment];
  }

  /**
   * Generate JWT bearer token for ChipiPay API authentication
   * This method is deprecated - use ChipiPayBearerTokenService instead
   * @deprecated Use ChipiPayBearerTokenService.generateToken() instead
   */
  async generateBearerToken(merchantId: string, environment: 'testnet' | 'mainnet'): Promise<string> {
    try {
      if (!merchantId) {
        throw new Error('Merchant ID is required for token generation');
      }

      const envConfig = this.getEnvironmentConfig(environment);
      const now = Math.floor(Date.now() / 1000);
      
      const payload: BearerTokenPayload = {
        merchantId,
        environment,
        iat: now,
        exp: now + (60 * 60) // 1 hour expiration
      };

      // Use the secret key for signing the JWT
      const token = jwt.sign(payload, envConfig.apiSecretKey, {
        algorithm: 'HS256',
        issuer: 'egyptfi-chipipay-integration',
        audience: 'chipipay-api'
      });

      this.logOperation('generateBearerToken', {
        merchantId,
        environment,
        tokenExpiry: new Date(payload.exp * 1000).toISOString()
      });

      return token;
    } catch (error) {
      this.logError('generateBearerToken', error, merchantId);
      throw new Error(`Token generation failed: ${error}`);
    }
  }

  /**
   * Validate the current configuration
   */
  validateConfiguration(): ConfigValidationError[] {
    const errors: ConfigValidationError[] = [];

    // Validate testnet configuration
    if (!this.config.testnet.apiPublicKey) {
      errors.push({
        field: 'CHIPI_PUBLIC_KEY_TESTNET',
        message: 'Testnet API public key is required'
      });
    }

    if (!this.config.testnet.apiSecretKey) {
      errors.push({
        field: 'CHIPI_SECRET_KEY_TESTNET',
        message: 'Testnet API secret key is required'
      });
    }

    if (!this.config.testnet.rpcUrl) {
      errors.push({
        field: 'STARKNET_RPC_URL_TESTNET',
        message: 'Testnet RPC URL is required'
      });
    }

    // Validate mainnet configuration
    if (!this.config.mainnet.apiPublicKey) {
      errors.push({
        field: 'CHIPI_PUBLIC_KEY_MAINNET',
        message: 'Mainnet API public key is required'
      });
    }

    if (!this.config.mainnet.apiSecretKey) {
      errors.push({
        field: 'CHIPI_SECRET_KEY_MAINNET',
        message: 'Mainnet API secret key is required'
      });
    }

    if (!this.config.mainnet.rpcUrl) {
      errors.push({
        field: 'STARKNET_RPC_URL_MAINNET',
        message: 'Mainnet RPC URL is required'
      });
    }

    // Validate common configuration
    if (!this.config.backendUrl) {
      errors.push({
        field: 'CHIPIPAY_URL',
        message: 'ChipiPay backend URL is required'
      });
    }

    if (!this.config.jwksEndpoint) {
      errors.push({
        field: 'CHIPIPAY_JWKS_ENDPOINT',
        message: 'JWKS endpoint is required for token validation'
      });
    }

    return errors;
  }

  /**
   * Check if the configuration is valid
   */
  isConfigurationValid(): boolean {
    return this.validationErrors.length === 0;
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfiguration(): ChipiPayConfig {
    return {
      testnet: {
        apiPublicKey: process.env.CHIPI_PUBLIC_KEY_TESTNET || process.env.CHIPI_PUBLIC_KEY || '',
        apiSecretKey: process.env.CHIPI_SECRET_KEY_TESTNET || process.env.CHIPI_SECRET_KEY || '',
        rpcUrl: process.env.STARKNET_RPC_URL_TESTNET || process.env.NEXT_PUBLIC_RPC_URL || ''
      },
      mainnet: {
        apiPublicKey: process.env.CHIPI_PUBLIC_KEY_MAINNET || process.env.CHIPI_PUBLIC_KEY || '',
        apiSecretKey: process.env.CHIPI_SECRET_KEY_MAINNET || process.env.CHIPI_SECRET_KEY || '',
        rpcUrl: process.env.STARKNET_RPC_URL_MAINNET || process.env.STARKNET_RPC_URL || ''
      },
      backendUrl: process.env.CHIPIPAY_URL || 'https://api.chipipay.com/v1',
      jwksEndpoint: process.env.CHIPIPAY_JWKS_ENDPOINT || '',
      defaultTimeout: parseInt(process.env.CHIPIPAY_TIMEOUT || '30000', 10)
    };
  }

  /**
   * Reload configuration from environment variables
   */
  reloadConfiguration(): void {
    this.config = this.loadConfiguration();
    this.validationErrors = this.validateConfiguration();
    
    this.logOperation('reloadConfiguration', {
      validationErrors: this.validationErrors.length,
      isValid: this.isConfigurationValid()
    });
  }

  /**
   * Get configuration summary for debugging
   */
  getConfigurationSummary(): any {
    return {
      backendUrl: this.config.backendUrl,
      jwksEndpoint: this.config.jwksEndpoint ? '***configured***' : 'missing',
      defaultTimeout: this.config.defaultTimeout,
      testnet: {
        apiPublicKey: this.config.testnet.apiPublicKey ? '***configured***' : 'missing',
        apiSecretKey: this.config.testnet.apiSecretKey ? '***configured***' : 'missing',
        rpcUrl: this.config.testnet.rpcUrl || 'missing'
      },
      mainnet: {
        apiPublicKey: this.config.mainnet.apiPublicKey ? '***configured***' : 'missing',
        apiSecretKey: this.config.mainnet.apiSecretKey ? '***configured***' : 'missing',
        rpcUrl: this.config.mainnet.rpcUrl || 'missing'
      },
      validationErrors: this.validationErrors.length,
      isValid: this.isConfigurationValid()
    };
  }

  /**
   * Validate JWT token (for incoming requests)
   */
  async validateBearerToken(token: string, environment: 'testnet' | 'mainnet'): Promise<BearerTokenPayload> {
    try {
      const envConfig = this.getEnvironmentConfig(environment);
      
      const decoded = jwt.verify(token, envConfig.apiSecretKey, {
        algorithms: ['HS256'],
        issuer: 'egyptfi-chipipay-integration',
        audience: 'chipipay-api'
      }) as BearerTokenPayload;

      // Validate token environment matches requested environment
      if (decoded.environment !== environment) {
        throw new Error(`Token environment mismatch: expected ${environment}, got ${decoded.environment}`);
      }

      return decoded;
    } catch (error) {
      this.logError('validateBearerToken', error);
      throw new Error(`Token validation failed: ${error}`);
    }
  }

  /**
   * Log operation for audit trail
   */
  private logOperation(operation: string, data: any): void {
    console.log(`[ChipiPayConfig] ${operation}:`, {
      timestamp: new Date().toISOString(),
      operation,
      ...data
    });
  }

  /**
   * Log error for debugging and monitoring
   */
  private logError(operation: string, error: any, context?: string): void {
    console.error(`[ChipiPayConfig] ${operation} failed:`, {
      timestamp: new Date().toISOString(),
      operation,
      error: error.message,
      context,
      stack: error.stack
    });
  }
}

// Export singleton instance
export const chipipayConfigService = new ChipiPayConfigServiceImpl();

// Validate configuration on startup
if (!chipipayConfigService.isConfigurationValid()) {
  console.warn('[ChipiPayConfig] Configuration validation failed. Some features may not work correctly.');
  console.warn('[ChipiPayConfig] Configuration summary:', chipipayConfigService.getConfigurationSummary());
}