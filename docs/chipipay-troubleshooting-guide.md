# ChipiPay Troubleshooting Guide

## Overview

This guide helps you diagnose and resolve common issues when integrating with ChipiPay's invisible wallet API. It includes detailed error codes, common scenarios, and step-by-step solutions.

## Error Code Reference

### Authentication Errors (4xx)

#### UNAUTHORIZED (401)
**Description**: Invalid or missing API key, or authentication failure.

**Common Causes**:
- Missing Authorization header
- Invalid API key format
- Expired or revoked API key
- Wrong environment (testnet key used on mainnet)

**Example Response**:
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing API key",
    "details": "API key must be provided in Authorization header",
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_1234567890"
  }
}
```

**Solutions**:
1. Verify API key is included in Authorization header:
   ```javascript
   headers: {
     'Authorization': `Bearer ${apiKey}`,
     'Content-Type': 'application/json'
   }
   ```

2. Check API key format:
   ```javascript
   // Valid formats
   pk_test_1234567890abcdef...  // Testnet
   pk_prod_1234567890abcdef...  // Mainnet
   ```

3. Ensure environment matches:
   ```javascript
   const apiKey = process.env.NODE_ENV === 'production'
     ? process.env.CHIPIPAY_API_KEY_MAINNET
     : process.env.CHIPIPAY_API_KEY_TESTNET;
   ```

#### INVALID_PIN (401)
**Description**: PIN is incorrect or cannot decrypt the wallet.

**Common Causes**:
- Incorrect PIN entered
- PIN format doesn't match requirements
- Wallet corruption or encryption issues
- PIN changed but not updated in application

**Example Response**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PIN",
    "message": "PIN is incorrect or cannot decrypt wallet",
    "details": "Unable to decrypt private key with provided PIN",
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_1234567890"
  }
}
```

**Solutions**:
1. Verify PIN format:
   ```javascript
   function validatePin(pin) {
     if (!/^[a-zA-Z0-9]{4,8}$/.test(pin)) {
       throw new Error('PIN must be 4-8 alphanumeric characters');
     }
   }
   ```

2. Implement PIN retry logic:
   ```javascript
   async function retryWithPin(operation, maxAttempts = 3) {
     for (let attempt = 1; attempt <= maxAttempts; attempt++) {
       try {
         const pin = await promptForPin(`Enter PIN (attempt ${attempt}/${maxAttempts}):`);
         return await operation(pin);
       } catch (error) {
         if (error.code !== 'INVALID_PIN' || attempt === maxAttempts) {
           throw error;
         }
       }
     }
   }
   ```

3. Check wallet status:
   ```javascript
   // Verify wallet exists and is properly encrypted
   const profile = await fetch('/api/merchants/profile', {
     headers: { 'Authorization': `Bearer ${apiKey}` }
   });
   ```

### Request Errors (4xx)

#### INVALID_PARAMETERS (400)
**Description**: Request parameters are missing, invalid, or malformed.

**Common Causes**:
- Missing required fields
- Invalid address format
- Invalid amount format
- Unsupported contract address

**Example Response**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMETERS",
    "message": "Invalid recipient address format",
    "details": "Address must be a valid Starknet address starting with 0x",
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_1234567890"
  }
}
```

**Solutions**:
1. Validate addresses:
   ```javascript
   function validateStarknetAddress(address) {
     if (!address || typeof address !== 'string') {
       throw new Error('Address is required');
     }
     
     if (!address.startsWith('0x')) {
       throw new Error('Address must start with 0x');
     }
     
     if (!/^0x[a-fA-F0-9]{1,64}$/.test(address)) {
       throw new Error('Invalid address format');
     }
   }
   ```

2. Validate amounts:
   ```javascript
   function validateAmount(amount) {
     if (!amount || isNaN(parseFloat(amount))) {
       throw new Error('Amount must be a valid number');
     }
     
     if (parseFloat(amount) <= 0) {
       throw new Error('Amount must be greater than 0');
     }
     
     if (parseFloat(amount) > 1000000) {
       throw new Error('Amount too large');
     }
   }
   ```

3. Check required fields:
   ```javascript
   function validateTransferRequest(request) {
     const required = ['pin', 'recipient', 'amount'];
     for (const field of required) {
       if (!request[field]) {
         throw new Error(`${field} is required`);
       }
     }
   }
   ```

#### INSUFFICIENT_BALANCE (400)
**Description**: Wallet doesn't have enough tokens for the transaction.

**Common Causes**:
- Not enough tokens in wallet
- Gas fees not accounted for
- Wrong token contract address
- Decimal precision issues

**Example Response**:
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Not enough tokens for transaction",
    "details": "Required: 100.5 ETH, Available: 50.2 ETH",
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_1234567890"
  }
}
```

**Solutions**:
1. Check balance before transactions:
   ```javascript
   async function checkBalance(contractAddress = null) {
     const response = await fetch('/api/merchants/wallet/balance', {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${apiKey}`,
         'Content-Type': 'application/json'
       },
       body: JSON.stringify({ contractAddress })
     });
     
     return await response.json();
   }
   ```

2. Account for gas fees:
   ```javascript
   async function validateTransferAmount(amount, contractAddress) {
     const balance = await checkBalance(contractAddress);
     const gasEstimate = await estimateGas('transfer');
     
     const totalRequired = parseFloat(amount) + parseFloat(gasEstimate);
     
     if (totalRequired > parseFloat(balance.available)) {
       throw new Error(`Insufficient balance. Required: ${totalRequired}, Available: ${balance.available}`);
     }
   }
   ```

#### RATE_LIMIT_EXCEEDED (429)
**Description**: Too many requests sent in a given time period.

**Rate Limits**:
- Per API Key: 100 requests per minute
- Per IP: 1000 requests per hour
- Wallet Operations: 10 transactions per minute

**Example Response**:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later",
    "details": "Rate limit: 100 requests per minute",
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_1234567890"
  }
}
```

**Solutions**:
1. Implement exponential backoff:
   ```javascript
   async function retryWithBackoff(operation, maxRetries = 3) {
     for (let attempt = 0; attempt < maxRetries; attempt++) {
       try {
         return await operation();
       } catch (error) {
         if (error.code !== 'RATE_LIMIT_EXCEEDED' || attempt === maxRetries - 1) {
           throw error;
         }
         
         const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
         await new Promise(resolve => setTimeout(resolve, delay));
       }
     }
   }
   ```

2. Check rate limit headers:
   ```javascript
   function checkRateLimit(response) {
     const remaining = response.headers.get('X-RateLimit-Remaining');
     const reset = response.headers.get('X-RateLimit-Reset');
     
     if (remaining && parseInt(remaining) < 10) {
       console.warn(`Rate limit warning: ${remaining} requests remaining`);
     }
   }
   ```

### Server Errors (5xx)

#### WALLET_CREATION_FAILED (500)
**Description**: Failed to create invisible wallet during registration.

**Common Causes**:
- ChipiPay API unavailable
- Network connectivity issues
- Invalid configuration
- Insufficient gas for wallet deployment

**Solutions**:
1. Check ChipiPay service status:
   ```javascript
   async function checkChipiPayStatus() {
     try {
       const response = await fetch('/api/health');
       const health = await response.json();
       return health.chipipay?.status === 'healthy';
     } catch (error) {
       return false;
     }
   }
   ```

2. Retry wallet creation:
   ```javascript
   async function createWalletWithRetry(email, pin, maxRetries = 3) {
     for (let attempt = 1; attempt <= maxRetries; attempt++) {
       try {
         return await registerMerchant(email, pin);
       } catch (error) {
         if (error.code !== 'WALLET_CREATION_FAILED' || attempt === maxRetries) {
           throw error;
         }
         
         const delay = attempt * 2000; // 2s, 4s, 6s
         await new Promise(resolve => setTimeout(resolve, delay));
       }
     }
   }
   ```

#### NETWORK_ERROR (503)
**Description**: Blockchain network or external service unavailable.

**Common Causes**:
- Starknet network congestion
- RPC endpoint unavailable
- ChipiPay API downtime
- Internet connectivity issues

**Solutions**:
1. Implement circuit breaker:
   ```javascript
   class CircuitBreaker {
     constructor(threshold = 5, timeout = 60000) {
       this.threshold = threshold;
       this.timeout = timeout;
       this.failureCount = 0;
       this.lastFailureTime = null;
       this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
     }

     async execute(operation) {
       if (this.state === 'OPEN') {
         if (Date.now() - this.lastFailureTime > this.timeout) {
           this.state = 'HALF_OPEN';
         } else {
           throw new Error('Circuit breaker is OPEN');
         }
       }

       try {
         const result = await operation();
         this.onSuccess();
         return result;
       } catch (error) {
         this.onFailure();
         throw error;
       }
     }

     onSuccess() {
       this.failureCount = 0;
       this.state = 'CLOSED';
     }

     onFailure() {
       this.failureCount++;
       this.lastFailureTime = Date.now();
       
       if (this.failureCount >= this.threshold) {
         this.state = 'OPEN';
       }
     }
   }
   ```

2. Check network status:
   ```javascript
   async function checkNetworkHealth() {
     const checks = [
       { name: 'Starknet RPC', url: '/api/health/starknet' },
       { name: 'ChipiPay API', url: '/api/health/chipipay' },
       { name: 'Database', url: '/api/health/database' }
     ];

     const results = await Promise.allSettled(
       checks.map(async check => {
         const response = await fetch(check.url);
         return { ...check, healthy: response.ok };
       })
     );

     return results.map(result => result.value);
   }
   ```

## Common Scenarios and Solutions

### Scenario 1: Registration Fails

**Symptoms**:
- Wallet creation fails during registration
- User receives "WALLET_CREATION_FAILED" error
- Registration process doesn't complete

**Diagnosis Steps**:
1. Check ChipiPay configuration:
   ```javascript
   async function diagnoseRegistrationFailure() {
     console.log('Checking ChipiPay configuration...');
     
     // Check environment variables
     const requiredEnvVars = [
       'CHIPIPAY_API_PUBLIC_KEY_TESTNET',
       'CHIPIPAY_JWKS_ENDPOINT',
       'CHIPIPAY_BACKEND_URL'
     ];
     
     for (const envVar of requiredEnvVars) {
       if (!process.env[envVar]) {
         console.error(`❌ Missing environment variable: ${envVar}`);
       } else {
         console.log(`✅ ${envVar} is set`);
       }
     }
     
     // Check API connectivity
     try {
       const response = await fetch('/api/health');
       const health = await response.json();
       console.log('Health check:', health);
     } catch (error) {
       console.error('❌ Health check failed:', error.message);
     }
   }
   ```

2. Test with minimal data:
   ```javascript
   async function testRegistration() {
     try {
       const result = await fetch('/api/merchants/register', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           business_email: 'test@example.com',
           pin: '123456'
         })
       });
       
       if (!result.ok) {
         const error = await result.json();
         console.error('Registration failed:', error);
       } else {
         console.log('✅ Registration successful');
       }
     } catch (error) {
       console.error('❌ Registration error:', error);
     }
   }
   ```

### Scenario 2: Wallet Operations Fail

**Symptoms**:
- Transfer/approve operations return errors
- Transactions don't appear on blockchain
- Inconsistent success rates

**Diagnosis Steps**:
1. Verify wallet state:
   ```javascript
   async function diagnoseWalletOperations(apiKey, pin) {
     console.log('Diagnosing wallet operations...');
     
     // Check merchant profile
     try {
       const profile = await fetch('/api/merchants/profile', {
         headers: { 'Authorization': `Bearer ${apiKey}` }
       });
       
       if (profile.ok) {
         const data = await profile.json();
         console.log('✅ Merchant profile loaded');
         console.log('Wallet public key:', data.wallet?.publicKey);
       } else {
         console.error('❌ Failed to load merchant profile');
       }
     } catch (error) {
       console.error('❌ Profile check failed:', error);
     }
     
     // Test PIN validation
     try {
       const testTransfer = await fetch('/api/merchants/wallet/transfer', {
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${apiKey}`,
           'Content-Type': 'application/json'
         },
         body: JSON.stringify({
           pin: pin,
           recipient: '0x1234567890abcdef', // Invalid address for testing
           amount: '0.001'
         })
       });
       
       const result = await testTransfer.json();
       if (result.error?.code === 'INVALID_PARAMETERS') {
         console.log('✅ PIN validation working (expected parameter error)');
       } else if (result.error?.code === 'INVALID_PIN') {
         console.error('❌ PIN validation failed');
       }
     } catch (error) {
       console.error('❌ PIN test failed:', error);
     }
   }
   ```

### Scenario 3: Performance Issues

**Symptoms**:
- Slow API response times
- Timeouts on wallet operations
- High error rates during peak usage

**Diagnosis Steps**:
1. Monitor response times:
   ```javascript
   class PerformanceMonitor {
     constructor() {
       this.metrics = new Map();
     }

     async measureOperation(name, operation) {
       const startTime = Date.now();
       
       try {
         const result = await operation();
         const duration = Date.now() - startTime;
         
         this.recordMetric(name, { success: true, duration });
         return result;
       } catch (error) {
         const duration = Date.now() - startTime;
         this.recordMetric(name, { success: false, duration, error: error.message });
         throw error;
       }
     }

     recordMetric(name, data) {
       if (!this.metrics.has(name)) {
         this.metrics.set(name, []);
       }
       
       this.metrics.get(name).push({
         ...data,
         timestamp: Date.now()
       });
     }

     getStats(name) {
       const data = this.metrics.get(name) || [];
       const recent = data.filter(d => Date.now() - d.timestamp < 300000); // Last 5 minutes
       
       const successful = recent.filter(d => d.success);
       const failed = recent.filter(d => !d.success);
       
       return {
         total: recent.length,
         successful: successful.length,
         failed: failed.length,
         successRate: successful.length / recent.length,
         avgDuration: successful.reduce((sum, d) => sum + d.duration, 0) / successful.length
       };
     }
   }

   // Usage
   const monitor = new PerformanceMonitor();

   const result = await monitor.measureOperation('transfer', () =>
     transferTokens(pin, recipient, amount)
   );

   console.log('Transfer stats:', monitor.getStats('transfer'));
   ```

## Debugging Tools

### 1. Debug Mode Client

```javascript
class DebugChipiPayClient {
  constructor(apiKey, debug = false) {
    this.apiKey = apiKey;
    this.debug = debug;
    this.requestLog = [];
  }

  async request(endpoint, data) {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    if (this.debug) {
      console.log(`🔍 [${requestId}] Starting request to ${endpoint}`);
      console.log(`📤 [${requestId}] Request data:`, this.sanitizeForLog(data));
    }

    try {
      const response = await fetch(`/api${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      const duration = Date.now() - startTime;

      this.requestLog.push({
        requestId,
        endpoint,
        success: response.ok,
        duration,
        statusCode: response.status,
        timestamp: new Date().toISOString()
      });

      if (this.debug) {
        console.log(`📥 [${requestId}] Response (${duration}ms):`, result);
      }

      if (!response.ok) {
        throw new Error(result.error?.message || 'Request failed');
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.requestLog.push({
        requestId,
        endpoint,
        success: false,
        duration,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      if (this.debug) {
        console.error(`❌ [${requestId}] Error (${duration}ms):`, error.message);
      }

      throw error;
    }
  }

  sanitizeForLog(data) {
    const sanitized = { ...data };
    if (sanitized.pin) {
      sanitized.pin = '[REDACTED]';
    }
    return sanitized;
  }

  getRequestLog() {
    return this.requestLog;
  }

  clearLog() {
    this.requestLog = [];
  }
}
```

### 2. Health Check Utility

```javascript
async function runHealthChecks() {
  const checks = [
    {
      name: 'API Health',
      check: async () => {
        const response = await fetch('/api/health');
        return response.ok;
      }
    },
    {
      name: 'ChipiPay Connectivity',
      check: async () => {
        const response = await fetch('/api/health');
        const data = await response.json();
        return data.chipipay?.status === 'healthy';
      }
    },
    {
      name: 'Database Connectivity',
      check: async () => {
        const response = await fetch('/api/health');
        const data = await response.json();
        return data.database?.status === 'healthy';
      }
    },
    {
      name: 'Starknet RPC',
      check: async () => {
        const response = await fetch('/api/health');
        const data = await response.json();
        return data.starknet?.status === 'healthy';
      }
    }
  ];

  console.log('🏥 Running health checks...\n');

  for (const { name, check } of checks) {
    try {
      const healthy = await check();
      console.log(`${healthy ? '✅' : '❌'} ${name}: ${healthy ? 'Healthy' : 'Unhealthy'}`);
    } catch (error) {
      console.log(`❌ ${name}: Error - ${error.message}`);
    }
  }
}
```

### 3. Configuration Validator

```javascript
function validateConfiguration() {
  const requiredEnvVars = {
    'CHIPIPAY_API_PUBLIC_KEY_TESTNET': 'ChipiPay testnet API key',
    'CHIPIPAY_API_PUBLIC_KEY_MAINNET': 'ChipiPay mainnet API key',
    'CHIPIPAY_JWKS_ENDPOINT': 'JWKS endpoint for token validation',
    'CHIPIPAY_BACKEND_URL': 'ChipiPay backend URL',
    'DATABASE_URL': 'Database connection string',
    'STARKNET_RPC_URL_TESTNET': 'Starknet testnet RPC URL',
    'STARKNET_RPC_URL_MAINNET': 'Starknet mainnet RPC URL'
  };

  console.log('🔧 Validating configuration...\n');

  let allValid = true;

  for (const [envVar, description] of Object.entries(requiredEnvVars)) {
    const value = process.env[envVar];
    
    if (!value) {
      console.log(`❌ ${envVar}: Missing (${description})`);
      allValid = false;
    } else {
      console.log(`✅ ${envVar}: Set`);
    }
  }

  // Validate API key formats
  const testnetKey = process.env.CHIPIPAY_API_PUBLIC_KEY_TESTNET;
  if (testnetKey && !testnetKey.startsWith('pk_test_')) {
    console.log(`❌ CHIPIPAY_API_PUBLIC_KEY_TESTNET: Invalid format (should start with pk_test_)`);
    allValid = false;
  }

  const mainnetKey = process.env.CHIPIPAY_API_PUBLIC_KEY_MAINNET;
  if (mainnetKey && !mainnetKey.startsWith('pk_prod_')) {
    console.log(`❌ CHIPIPAY_API_PUBLIC_KEY_MAINNET: Invalid format (should start with pk_prod_)`);
    allValid = false;
  }

  console.log(`\n${allValid ? '✅' : '❌'} Configuration ${allValid ? 'valid' : 'invalid'}`);
  return allValid;
}
```

## Getting Help

### Before Contacting Support

1. **Check this troubleshooting guide** for your specific error code
2. **Run health checks** to identify system issues
3. **Validate your configuration** using the provided tools
4. **Check the request logs** for patterns or specific failures
5. **Test with minimal examples** to isolate the issue

### When Contacting Support

Include the following information:

1. **Error Details**:
   - Error code and message
   - Request ID from error response
   - Timestamp of the error

2. **Environment Information**:
   - Environment (testnet/mainnet)
   - API key prefix (first 10 characters)
   - Application version

3. **Request Details**:
   - Endpoint being called
   - Request parameters (sanitized)
   - Expected vs actual behavior

4. **Debugging Information**:
   - Health check results
   - Configuration validation results
   - Recent request logs

### Support Channels

- **Email**: support@chipipay.com
- **GitHub Issues**: For bug reports and feature requests
- **Discord**: Community support and discussions
- **Documentation**: Latest guides and API reference

### Response Times

- **Critical Issues** (service down): 2 hours
- **High Priority** (functionality broken): 24 hours
- **Medium Priority** (performance issues): 48 hours
- **Low Priority** (questions, enhancements): 5 business days

Remember to include the request ID from error responses for faster resolution!