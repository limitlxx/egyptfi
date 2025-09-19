#!/usr/bin/env node

/**
 * Health Check Script for ChipiPay Integration
 * 
 * This script performs comprehensive health checks to verify that all
 * components of the ChipiPay integration are working correctly.
 */

const fetch = require('node-fetch');
const { Pool } = require('pg');

class HealthChecker {
  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    this.results = [];
  }

  async checkHealth(name, checkFunction) {
    const startTime = Date.now();
    
    try {
      const result = await checkFunction();
      const duration = Date.now() - startTime;
      
      this.results.push({
        name,
        status: 'healthy',
        duration,
        details: result
      });
      
      console.log(`✅ ${name}: Healthy (${duration}ms)`);
      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.results.push({
        name,
        status: 'unhealthy',
        duration,
        error: error.message
      });
      
      console.log(`❌ ${name}: Unhealthy (${duration}ms) - ${error.message}`);
      return false;
    }
  }

  async checkApplicationHealth() {
    return await this.checkHealth('Application Health', async () => {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        timeout: 10000
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.status !== 'healthy') {
        throw new Error(`Application status: ${data.status}`);
      }
      
      return data;
    });
  }

  async checkDatabaseHealth() {
    return await this.checkHealth('Database Connectivity', async () => {
      if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL not configured');
      }

      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });

      try {
        const result = await pool.query('SELECT NOW() as current_time, version() as version');
        const row = result.rows[0];
        
        return {
          connected: true,
          currentTime: row.current_time,
          version: row.version.split(' ')[0] + ' ' + row.version.split(' ')[1]
        };
      } finally {
        await pool.end();
      }
    });
  }

  async checkChipiPayIntegration() {
    return await this.checkHealth('ChipiPay Integration', async () => {
      // Check environment variables
      const requiredVars = [
        'CHIPIPAY_BACKEND_URL',
        'CHIPIPAY_JWKS_ENDPOINT'
      ];

      const environment = process.env.NODE_ENV || 'development';
      
      if (environment === 'production') {
        requiredVars.push('CHIPIPAY_API_PUBLIC_KEY_MAINNET');
        requiredVars.push('CHIPIPAY_API_SECRET_KEY_MAINNET');
      } else {
        requiredVars.push('CHIPIPAY_API_PUBLIC_KEY_TESTNET');
        requiredVars.push('CHIPIPAY_API_SECRET_KEY_TESTNET');
      }

      const missingVars = requiredVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length > 0) {
        throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
      }

      // Test ChipiPay configuration endpoint
      const response = await fetch(`${this.baseUrl}/api/health`, {
        timeout: 10000
      });
      
      if (!response.ok) {
        throw new Error(`Health endpoint failed: HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.chipipay || data.chipipay.status !== 'healthy') {
        throw new Error(`ChipiPay status: ${data.chipipay?.status || 'unknown'}`);
      }

      return {
        environment,
        backendUrl: process.env.CHIPIPAY_BACKEND_URL,
        jwksEndpoint: process.env.CHIPIPAY_JWKS_ENDPOINT,
        status: data.chipipay.status
      };
    });
  }

  async checkStarknetConnectivity() {
    return await this.checkHealth('Starknet Connectivity', async () => {
      const environment = process.env.NODE_ENV || 'development';
      const rpcUrl = environment === 'production' 
        ? process.env.STARKNET_RPC_URL_MAINNET
        : process.env.STARKNET_RPC_URL_TESTNET;

      if (!rpcUrl) {
        throw new Error(`Starknet RPC URL not configured for ${environment}`);
      }

      // Test RPC connectivity
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'starknet_chainId',
          params: [],
          id: 1
        }),
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`RPC request failed: HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`RPC error: ${data.error.message}`);
      }

      return {
        environment,
        rpcUrl,
        chainId: data.result,
        network: environment === 'production' ? 'mainnet' : 'testnet'
      };
    });
  }

  async checkAPIEndpoints() {
    return await this.checkHealth('API Endpoints', async () => {
      const endpoints = [
        { path: '/api/health', method: 'GET', expectedStatus: 200 },
        { path: '/api/merchants/register', method: 'POST', expectedStatus: 400 }, // Should fail without body
      ];

      const results = [];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`${this.baseUrl}${endpoint.path}`, {
            method: endpoint.method,
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 5000
          });

          const isExpectedStatus = response.status === endpoint.expectedStatus;
          
          results.push({
            path: endpoint.path,
            method: endpoint.method,
            status: response.status,
            expected: endpoint.expectedStatus,
            healthy: isExpectedStatus
          });

          if (!isExpectedStatus) {
            throw new Error(`${endpoint.path} returned ${response.status}, expected ${endpoint.expectedStatus}`);
          }
        } catch (error) {
          results.push({
            path: endpoint.path,
            method: endpoint.method,
            error: error.message,
            healthy: false
          });
          throw error;
        }
      }

      return results;
    });
  }

  async checkSecurityConfiguration() {
    return await this.checkHealth('Security Configuration', async () => {
      const securityChecks = [];

      // Check JWT secret
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET not configured');
      }
      
      if (jwtSecret.length < 32) {
        throw new Error('JWT_SECRET should be at least 32 characters');
      }
      
      securityChecks.push({ check: 'JWT_SECRET', status: 'valid', length: jwtSecret.length });

      // Check wallet encryption salt
      const walletSalt = process.env.WALLET_ENCRYPTION_SALT;
      if (!walletSalt) {
        throw new Error('WALLET_ENCRYPTION_SALT not configured');
      }
      
      if (walletSalt.length < 32) {
        throw new Error('WALLET_ENCRYPTION_SALT should be at least 32 characters');
      }
      
      securityChecks.push({ check: 'WALLET_ENCRYPTION_SALT', status: 'valid', length: walletSalt.length });

      // Check HTTPS in production
      if (process.env.NODE_ENV === 'production') {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL;
        if (!appUrl || !appUrl.startsWith('https://')) {
          throw new Error('Production environment must use HTTPS');
        }
        securityChecks.push({ check: 'HTTPS', status: 'enabled' });
      }

      // Check rate limiting configuration
      const rateLimitVars = [
        'RATE_LIMIT_REQUESTS_PER_MINUTE',
        'RATE_LIMIT_WALLET_OPS_PER_MINUTE',
        'RATE_LIMIT_REQUESTS_PER_HOUR'
      ];

      for (const varName of rateLimitVars) {
        const value = process.env[varName];
        if (value && (isNaN(Number(value)) || Number(value) <= 0)) {
          throw new Error(`${varName} must be a positive number`);
        }
        securityChecks.push({ 
          check: varName, 
          status: 'valid', 
          value: value || 'default' 
        });
      }

      return securityChecks;
    });
  }

  async checkMonitoringConfiguration() {
    return await this.checkHealth('Monitoring Configuration', async () => {
      const monitoringChecks = [];

      // Check metrics configuration
      const metricsEnabled = process.env.ENABLE_METRICS;
      monitoringChecks.push({
        check: 'ENABLE_METRICS',
        status: metricsEnabled === 'true' ? 'enabled' : 'disabled'
      });

      // Check alerting configuration
      const alertingEnabled = process.env.ENABLE_ALERTING;
      monitoringChecks.push({
        check: 'ENABLE_ALERTING',
        status: alertingEnabled === 'true' ? 'enabled' : 'disabled'
      });

      // Check alert email in production
      if (process.env.NODE_ENV === 'production' && alertingEnabled === 'true') {
        const alertEmail = process.env.ALERT_EMAIL;
        if (!alertEmail) {
          throw new Error('ALERT_EMAIL required when alerting is enabled in production');
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(alertEmail)) {
          throw new Error('ALERT_EMAIL must be a valid email address');
        }
        
        monitoringChecks.push({
          check: 'ALERT_EMAIL',
          status: 'valid',
          email: alertEmail
        });
      }

      return monitoringChecks;
    });
  }

  async runAllChecks() {
    console.log('🏥 Starting comprehensive health checks...\n');
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Base URL: ${this.baseUrl}\n`);

    const checks = [
      () => this.checkApplicationHealth(),
      () => this.checkDatabaseHealth(),
      () => this.checkChipiPayIntegration(),
      () => this.checkStarknetConnectivity(),
      () => this.checkAPIEndpoints(),
      () => this.checkSecurityConfiguration(),
      () => this.checkMonitoringConfiguration()
    ];

    let healthyCount = 0;
    let totalChecks = checks.length;

    for (const check of checks) {
      const isHealthy = await check();
      if (isHealthy) {
        healthyCount++;
      }
      console.log(''); // Add spacing between checks
    }

    return this.generateReport(healthyCount, totalChecks);
  }

  generateReport(healthyCount, totalChecks) {
    console.log('='.repeat(60));
    console.log('📋 HEALTH CHECK REPORT');
    console.log('='.repeat(60));
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total Checks: ${totalChecks}`);
    console.log(`   Healthy: ${healthyCount}`);
    console.log(`   Unhealthy: ${totalChecks - healthyCount}`);
    console.log(`   Success Rate: ${Math.round((healthyCount / totalChecks) * 100)}%`);

    const isOverallHealthy = healthyCount === totalChecks;
    
    if (isOverallHealthy) {
      console.log('\n🎉 All health checks passed! System is ready for operation.');
    } else {
      console.log('\n⚠️  Some health checks failed. Please review the issues above.');
      
      const unhealthyChecks = this.results.filter(r => r.status === 'unhealthy');
      console.log('\n❌ Failed Checks:');
      unhealthyChecks.forEach(check => {
        console.log(`   - ${check.name}: ${check.error}`);
      });
    }

    console.log(`\n📅 Check completed at: ${new Date().toISOString()}`);
    
    return isOverallHealthy;
  }

  getDetailedReport() {
    return {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      baseUrl: this.baseUrl,
      results: this.results,
      summary: {
        total: this.results.length,
        healthy: this.results.filter(r => r.status === 'healthy').length,
        unhealthy: this.results.filter(r => r.status === 'unhealthy').length
      }
    };
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const outputFormat = args.includes('--json') ? 'json' : 'console';
  const exitOnFailure = !args.includes('--no-exit');

  const checker = new HealthChecker();

  try {
    const isHealthy = await checker.runAllChecks();

    if (outputFormat === 'json') {
      console.log(JSON.stringify(checker.getDetailedReport(), null, 2));
    }

    if (!isHealthy && exitOnFailure) {
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Health check failed with error:', error.message);
    
    if (outputFormat === 'json') {
      console.log(JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString()
      }, null, 2));
    }

    if (exitOnFailure) {
      process.exit(1);
    }
  }
}

// Run if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = { HealthChecker };