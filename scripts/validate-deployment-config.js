#!/usr/bin/env node

/**
 * ChipiPay Integration Deployment Configuration Validator
 * 
 * This script validates that all required environment variables and configurations
 * are properly set for ChipiPay integration deployment.
 */

const fs = require('fs');
const path = require('path');

class DeploymentValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.environment = process.env.NODE_ENV || 'development';
  }

  validateEnvironmentVariables() {
    console.log('🔍 Validating environment variables...\n');

    const requiredVars = {
      // Core Application
      'NODE_ENV': {
        required: true,
        description: 'Application environment',
        validValues: ['development', 'staging', 'production']
      },
      'DATABASE_URL': {
        required: true,
        description: 'PostgreSQL database connection string',
        pattern: /^postgresql:\/\/.+/
      },
      'JWT_SECRET': {
        required: true,
        description: 'JWT signing secret',
        minLength: 32
      },
      'EGYPTFI_SECRET': {
        required: true,
        description: 'EgyptFi master secret',
        minLength: 32
      },
      'NEXT_PUBLIC_APP_URL': {
        required: true,
        description: 'Application base URL',
        pattern: /^https?:\/\/.+/
      },

      // ChipiPay Configuration
      'CHIPIPAY_BACKEND_URL': {
        required: true,
        description: 'ChipiPay backend API URL',
        pattern: /^https:\/\/.+/,
        default: 'https://api.chipipay.com/v1'
      },
      'CHIPIPAY_JWKS_ENDPOINT': {
        required: true,
        description: 'ChipiPay JWKS endpoint for token validation',
        pattern: /^https:\/\/.+\/\.well-known\/jwks\.json$/
      },
      'CHIPIPAY_TIMEOUT': {
        required: false,
        description: 'ChipiPay API timeout in milliseconds',
        type: 'number',
        default: '30000'
      },

      // ChipiPay API Keys
      'CHIPIPAY_API_PUBLIC_KEY_TESTNET': {
        required: this.environment !== 'production',
        description: 'ChipiPay testnet public API key',
        pattern: /^pk_test_[a-zA-Z0-9]+$/
      },
      'CHIPIPAY_API_SECRET_KEY_TESTNET': {
        required: this.environment !== 'production',
        description: 'ChipiPay testnet secret API key',
        pattern: /^sk_test_[a-zA-Z0-9]+$/
      },
      'CHIPIPAY_API_PUBLIC_KEY_MAINNET': {
        required: this.environment === 'production',
        description: 'ChipiPay mainnet public API key',
        pattern: /^pk_prod_[a-zA-Z0-9]+$/
      },
      'CHIPIPAY_API_SECRET_KEY_MAINNET': {
        required: this.environment === 'production',
        description: 'ChipiPay mainnet secret API key',
        pattern: /^sk_prod_[a-zA-Z0-9]+$/
      },

      // Starknet Configuration
      'STARKNET_RPC_URL_TESTNET': {
        required: this.environment !== 'production',
        description: 'Starknet testnet RPC URL',
        pattern: /^https:\/\/.+/
      },
      'STARKNET_RPC_URL_MAINNET': {
        required: this.environment === 'production',
        description: 'Starknet mainnet RPC URL',
        pattern: /^https:\/\/.+/
      },

      // Security Configuration
      'WALLET_ENCRYPTION_SALT': {
        required: true,
        description: 'Salt for wallet encryption',
        minLength: 32
      },
      'PIN_VALIDATION_REGEX': {
        required: false,
        description: 'Regular expression for PIN validation',
        default: '^[a-zA-Z0-9]{4,8}$'
      },
      'MAX_PIN_ATTEMPTS': {
        required: false,
        description: 'Maximum PIN attempts before lockout',
        type: 'number',
        default: '3'
      },
      'PIN_LOCKOUT_TIME': {
        required: false,
        description: 'PIN lockout time in milliseconds',
        type: 'number',
        default: '300000'
      },

      // Rate Limiting
      'RATE_LIMIT_REQUESTS_PER_MINUTE': {
        required: false,
        description: 'Rate limit for requests per minute',
        type: 'number',
        default: '100'
      },
      'RATE_LIMIT_WALLET_OPS_PER_MINUTE': {
        required: false,
        description: 'Rate limit for wallet operations per minute',
        type: 'number',
        default: '10'
      },
      'RATE_LIMIT_REQUESTS_PER_HOUR': {
        required: false,
        description: 'Rate limit for requests per hour',
        type: 'number',
        default: '1000'
      },

      // Monitoring
      'ENABLE_METRICS': {
        required: false,
        description: 'Enable metrics collection',
        type: 'boolean',
        default: 'true'
      },
      'ENABLE_ALERTING': {
        required: false,
        description: 'Enable alerting',
        type: 'boolean',
        default: this.environment === 'production' ? 'true' : 'false'
      },
      'ALERT_EMAIL': {
        required: this.environment === 'production',
        description: 'Email for alerts',
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      }
    };

    for (const [varName, config] of Object.entries(requiredVars)) {
      this.validateEnvironmentVariable(varName, config);
    }

    this.validateEnvironmentSpecificVars();
  }

  validateEnvironmentVariable(varName, config) {
    const value = process.env[varName];

    // Check if required variable is missing
    if (config.required && !value) {
      this.errors.push(`❌ Missing required environment variable: ${varName} (${config.description})`);
      return;
    }

    // Skip validation if variable is not set and not required
    if (!value) {
      if (config.default) {
        this.warnings.push(`⚠️  Using default value for ${varName}: ${config.default}`);
      }
      return;
    }

    // Validate pattern
    if (config.pattern && !config.pattern.test(value)) {
      this.errors.push(`❌ Invalid format for ${varName}: ${config.description}`);
      return;
    }

    // Validate minimum length
    if (config.minLength && value.length < config.minLength) {
      this.errors.push(`❌ ${varName} must be at least ${config.minLength} characters long`);
      return;
    }

    // Validate type
    if (config.type === 'number' && isNaN(Number(value))) {
      this.errors.push(`❌ ${varName} must be a valid number`);
      return;
    }

    if (config.type === 'boolean' && !['true', 'false'].includes(value.toLowerCase())) {
      this.errors.push(`❌ ${varName} must be 'true' or 'false'`);
      return;
    }

    // Validate valid values
    if (config.validValues && !config.validValues.includes(value)) {
      this.errors.push(`❌ ${varName} must be one of: ${config.validValues.join(', ')}`);
      return;
    }

    console.log(`✅ ${varName}: Valid`);
  }

  validateEnvironmentSpecificVars() {
    // Validate environment-specific requirements
    if (this.environment === 'production') {
      // Production should use mainnet keys
      if (process.env.CHIPIPAY_API_PUBLIC_KEY_TESTNET && !process.env.CHIPIPAY_API_PUBLIC_KEY_MAINNET) {
        this.warnings.push('⚠️  Production environment has testnet keys but no mainnet keys');
      }

      // Production should use HTTPS
      if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.startsWith('https://')) {
        this.errors.push('❌ Production environment must use HTTPS for NEXT_PUBLIC_APP_URL');
      }
    }

    // Validate key pairs match
    const testnetPublic = process.env.CHIPIPAY_API_PUBLIC_KEY_TESTNET;
    const testnetSecret = process.env.CHIPIPAY_API_SECRET_KEY_TESTNET;
    
    if ((testnetPublic && !testnetSecret) || (!testnetPublic && testnetSecret)) {
      this.errors.push('❌ ChipiPay testnet public and secret keys must both be set or both be unset');
    }

    const mainnetPublic = process.env.CHIPIPAY_API_PUBLIC_KEY_MAINNET;
    const mainnetSecret = process.env.CHIPIPAY_API_SECRET_KEY_MAINNET;
    
    if ((mainnetPublic && !mainnetSecret) || (!mainnetPublic && mainnetSecret)) {
      this.errors.push('❌ ChipiPay mainnet public and secret keys must both be set or both be unset');
    }
  }

  validateDatabaseConnection() {
    console.log('\n🔍 Validating database configuration...\n');

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      this.errors.push('❌ DATABASE_URL is required for database validation');
      return;
    }

    try {
      const url = new URL(databaseUrl);
      
      if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
        this.errors.push('❌ DATABASE_URL must use postgresql:// or postgres:// protocol');
        return;
      }

      if (!url.hostname) {
        this.errors.push('❌ DATABASE_URL must include hostname');
        return;
      }

      if (!url.pathname || url.pathname === '/') {
        this.errors.push('❌ DATABASE_URL must include database name');
        return;
      }

      console.log('✅ Database URL format: Valid');
      console.log(`✅ Database host: ${url.hostname}`);
      console.log(`✅ Database name: ${url.pathname.substring(1)}`);
      
    } catch (error) {
      this.errors.push(`❌ Invalid DATABASE_URL format: ${error.message}`);
    }
  }

  validateFileStructure() {
    console.log('\n🔍 Validating file structure...\n');

    const requiredFiles = [
      'package.json',
      'next.config.mjs',
      'database/migrations/001_add_wallet_fields_to_merchants.sql',
      'database/migrations/002_create_chipipay_config_and_logging_tables.sql',
      'database/migrations/003_create_logging_tables.sql',
      'database/migrations/004_create_metrics_tables.sql',
      'services/chipipayService.ts',
      'services/chipipayConfigService.ts',
      'lib/chipipay-auth.ts',
      'lib/wallet-crypto.ts'
    ];

    const requiredDirectories = [
      'app/api/merchants/wallet',
      'database/migrations',
      'services',
      'lib',
      'docs'
    ];

    // Check files
    for (const file of requiredFiles) {
      if (fs.existsSync(file)) {
        console.log(`✅ File exists: ${file}`);
      } else {
        this.errors.push(`❌ Missing required file: ${file}`);
      }
    }

    // Check directories
    for (const dir of requiredDirectories) {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        console.log(`✅ Directory exists: ${dir}`);
      } else {
        this.errors.push(`❌ Missing required directory: ${dir}`);
      }
    }
  }

  validatePackageDependencies() {
    console.log('\n🔍 Validating package dependencies...\n');

    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      
      const requiredDependencies = [
        'next',
        'react',
        'pg',
        'jsonwebtoken',
        'bcryptjs'
      ];

      const requiredDevDependencies = [
        'jest',
        '@types/node',
        'typescript'
      ];

      // Check dependencies
      for (const dep of requiredDependencies) {
        if (packageJson.dependencies && packageJson.dependencies[dep]) {
          console.log(`✅ Dependency: ${dep}`);
        } else {
          this.errors.push(`❌ Missing required dependency: ${dep}`);
        }
      }

      // Check dev dependencies
      for (const dep of requiredDevDependencies) {
        if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
          console.log(`✅ Dev dependency: ${dep}`);
        } else {
          this.warnings.push(`⚠️  Missing recommended dev dependency: ${dep}`);
        }
      }

    } catch (error) {
      this.errors.push(`❌ Error reading package.json: ${error.message}`);
    }
  }

  validateSecurityConfiguration() {
    console.log('\n🔍 Validating security configuration...\n');

    // Check JWT secret strength
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret) {
      if (jwtSecret.length < 32) {
        this.errors.push('❌ JWT_SECRET should be at least 32 characters long');
      } else if (!/[A-Z]/.test(jwtSecret) || !/[a-z]/.test(jwtSecret) || !/[0-9]/.test(jwtSecret)) {
        this.warnings.push('⚠️  JWT_SECRET should contain uppercase, lowercase, and numeric characters');
      } else {
        console.log('✅ JWT_SECRET: Strong');
      }
    }

    // Check wallet encryption salt
    const walletSalt = process.env.WALLET_ENCRYPTION_SALT;
    if (walletSalt) {
      if (walletSalt.length < 32) {
        this.errors.push('❌ WALLET_ENCRYPTION_SALT should be at least 32 characters long');
      } else {
        console.log('✅ WALLET_ENCRYPTION_SALT: Valid length');
      }
    }

    // Check PIN validation regex
    const pinRegex = process.env.PIN_VALIDATION_REGEX || '^[a-zA-Z0-9]{4,8}$';
    try {
      new RegExp(pinRegex);
      console.log('✅ PIN_VALIDATION_REGEX: Valid regex');
    } catch (error) {
      this.errors.push(`❌ Invalid PIN_VALIDATION_REGEX: ${error.message}`);
    }

    // Validate rate limiting values
    const rateLimits = {
      'RATE_LIMIT_REQUESTS_PER_MINUTE': 100,
      'RATE_LIMIT_WALLET_OPS_PER_MINUTE': 10,
      'RATE_LIMIT_REQUESTS_PER_HOUR': 1000
    };

    for (const [varName, defaultValue] of Object.entries(rateLimits)) {
      const value = parseInt(process.env[varName] || defaultValue);
      if (isNaN(value) || value <= 0) {
        this.errors.push(`❌ ${varName} must be a positive number`);
      } else if (value > 10000) {
        this.warnings.push(`⚠️  ${varName} is very high (${value}), consider if this is intentional`);
      } else {
        console.log(`✅ ${varName}: ${value}`);
      }
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 DEPLOYMENT VALIDATION REPORT');
    console.log('='.repeat(60));
    
    console.log(`\n🌍 Environment: ${this.environment}`);
    console.log(`📅 Validation Date: ${new Date().toISOString()}`);
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('\n🎉 All validations passed! Configuration is ready for deployment.');
    } else {
      if (this.errors.length > 0) {
        console.log(`\n❌ Found ${this.errors.length} error(s):`);
        this.errors.forEach(error => console.log(`   ${error}`));
      }

      if (this.warnings.length > 0) {
        console.log(`\n⚠️  Found ${this.warnings.length} warning(s):`);
        this.warnings.forEach(warning => console.log(`   ${warning}`));
      }

      if (this.errors.length > 0) {
        console.log('\n❌ Configuration validation failed. Please fix the errors above before deploying.');
        return false;
      } else {
        console.log('\n✅ Configuration validation passed with warnings. Review warnings before deploying.');
      }
    }

    return true;
  }

  run() {
    console.log('🚀 ChipiPay Integration Deployment Configuration Validator');
    console.log('='.repeat(60));

    this.validateEnvironmentVariables();
    this.validateDatabaseConnection();
    this.validateFileStructure();
    this.validatePackageDependencies();
    this.validateSecurityConfiguration();

    const isValid = this.generateReport();
    
    if (!isValid) {
      process.exit(1);
    }
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  const validator = new DeploymentValidator();
  validator.run();
}

module.exports = { DeploymentValidator };