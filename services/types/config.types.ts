// Configuration Types and Interfaces

export interface ChipiPayEnvironmentConfig {
  apiPublicKey: string;
  apiSecretKey: string;
  rpcUrl: string;
}

export interface ChipiPayConfig {
  testnet: ChipiPayEnvironmentConfig;
  mainnet: ChipiPayEnvironmentConfig;
  backendUrl: string;
  jwksEndpoint: string;
  defaultTimeout: number;
}

export interface BearerTokenPayload {
  merchantId: string;
  environment: 'testnet' | 'mainnet';
  iat: number;
  exp: number;
}

export interface ConfigValidationError {
  field: string;
  message: string;
}

export interface ChipiPayConfigService {
  getConfig(): ChipiPayConfig;
  getEnvironmentConfig(environment: 'testnet' | 'mainnet'): ChipiPayEnvironmentConfig;
  generateBearerToken(merchantId: string, environment: 'testnet' | 'mainnet'): Promise<string>;
  validateConfiguration(): ConfigValidationError[];
  isConfigurationValid(): boolean;
}

export enum ConfigErrorCodes {
  MISSING_API_KEY = 'MISSING_API_KEY',
  MISSING_SECRET_KEY = 'MISSING_SECRET_KEY',
  MISSING_RPC_URL = 'MISSING_RPC_URL',
  MISSING_JWKS_ENDPOINT = 'MISSING_JWKS_ENDPOINT',
  INVALID_ENVIRONMENT = 'INVALID_ENVIRONMENT',
  TOKEN_GENERATION_FAILED = 'TOKEN_GENERATION_FAILED'
}