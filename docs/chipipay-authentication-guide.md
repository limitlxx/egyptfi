# ChipiPay Authentication Guide

## Overview

ChipiPay uses a dual-layer authentication system to ensure secure access to wallet operations:

1. **API Key Authentication**: Identifies and authorizes your merchant account
2. **PIN Authentication**: Authorizes specific wallet operations

This guide covers how to properly implement and manage both authentication layers.

## API Key Authentication

### API Key Types

ChipiPay provides two types of API keys for different environments:

| Environment | Prefix | Purpose | Network |
|-------------|--------|---------|---------|
| Testnet | `pk_test_` | Development and testing | Starknet Sepolia |
| Mainnet | `pk_prod_` | Production use | Starknet Mainnet |

### Getting Your API Keys

API keys are automatically generated during merchant registration:

1. Complete the registration process with email and PIN
2. Your invisible wallet will be created
3. API keys will be generated for both testnet and mainnet
4. Keys are returned in the registration response and available in your dashboard

### Using API Keys

Include your API key in the `Authorization` header of all requests:

```http
Authorization: Bearer pk_test_1234567890abcdef...
Content-Type: application/json
```

#### JavaScript Example
```javascript
const headers = {
  'Authorization': `Bearer ${process.env.CHIPIPAY_API_KEY}`,
  'Content-Type': 'application/json'
};

const response = await fetch('/api/merchants/wallet/transfer', {
  method: 'POST',
  headers: headers,
  body: JSON.stringify(requestData)
});
```

#### cURL Example
```bash
curl -X POST https://your-domain.com/api/merchants/wallet/transfer \
  -H "Authorization: Bearer pk_test_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"pin": "123456", "recipient": "0x...", "amount": "100"}'
```

### API Key Security Best Practices

#### 1. Secure Storage
```javascript
// ✅ Good: Use environment variables
const apiKey = process.env.CHIPIPAY_API_KEY;

// ❌ Bad: Hardcode in source code
const apiKey = 'pk_test_1234567890abcdef...';
```

#### 2. Environment Separation
```javascript
// Use different keys for different environments
const apiKey = process.env.NODE_ENV === 'production' 
  ? process.env.CHIPIPAY_API_KEY_MAINNET
  : process.env.CHIPIPAY_API_KEY_TESTNET;
```

#### 3. Key Rotation
- Rotate API keys regularly (recommended: every 90 days)
- Use the merchant dashboard to generate new keys
- Update all applications before revoking old keys

#### 4. Access Control
- Limit API key access to necessary personnel
- Use different keys for different applications/environments
- Monitor API key usage for unusual patterns

## PIN Authentication

### PIN Requirements

PINs must meet the following criteria:
- Length: 4-8 characters
- Format: Alphanumeric (letters and numbers)
- Uniqueness: Should be unique to the user
- Memorability: Easy for the user to remember

### PIN Security Model

Your PIN serves multiple security functions:

1. **Encryption Key**: Used to encrypt your wallet's private key
2. **Authentication Factor**: Proves you have authorization to use the wallet
3. **Access Control**: Required for all wallet operations

```mermaid
graph LR
    A[User PIN] --> B[Encryption Key]
    B --> C[Decrypt Private Key]
    C --> D[Sign Transaction]
    D --> E[Execute Operation]
```

### Using PINs in API Calls

PINs are included in the request body for wallet operations:

```json
{
  "pin": "123456",
  "recipient": "0x1234567890abcdef...",
  "amount": "100.0"
}
```

#### Example: Transfer with PIN
```javascript
async function transferWithPin(pin, recipient, amount) {
  const response = await fetch('/api/merchants/wallet/transfer', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      pin: pin,
      recipient: recipient,
      amount: amount
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error.message);
  }

  return await response.json();
}
```

### PIN Security Best Practices

#### 1. Never Store PINs
```javascript
// ✅ Good: Prompt user for PIN when needed
const pin = await promptUserForPin();
await transferTokens(pin, recipient, amount);

// ❌ Bad: Store PIN in variables or localStorage
localStorage.setItem('userPin', pin); // Never do this!
```

#### 2. Validate PIN Format
```javascript
function validatePin(pin) {
  // Check length (4-8 characters)
  if (pin.length < 4 || pin.length > 8) {
    throw new Error('PIN must be 4-8 characters long');
  }

  // Check format (alphanumeric)
  if (!/^[a-zA-Z0-9]+$/.test(pin)) {
    throw new Error('PIN must contain only letters and numbers');
  }

  return true;
}
```

#### 3. Handle PIN Errors Gracefully
```javascript
async function handlePinOperation(operation) {
  try {
    return await operation();
  } catch (error) {
    if (error.code === 'INVALID_PIN') {
      // Give user another chance to enter PIN
      const newPin = await promptUserForPin('Invalid PIN. Please try again:');
      return await operation(newPin);
    }
    throw error;
  }
}
```

#### 4. Implement PIN Attempt Limiting
```javascript
class PinAttemptLimiter {
  constructor(maxAttempts = 3, lockoutTime = 300000) { // 5 minutes
    this.maxAttempts = maxAttempts;
    this.lockoutTime = lockoutTime;
    this.attempts = new Map();
  }

  canAttempt(userId) {
    const userAttempts = this.attempts.get(userId);
    if (!userAttempts) return true;

    if (userAttempts.count >= this.maxAttempts) {
      const timeSinceLastAttempt = Date.now() - userAttempts.lastAttempt;
      if (timeSinceLastAttempt < this.lockoutTime) {
        return false;
      } else {
        // Reset attempts after lockout period
        this.attempts.delete(userId);
        return true;
      }
    }

    return true;
  }

  recordAttempt(userId, success) {
    if (success) {
      this.attempts.delete(userId);
    } else {
      const userAttempts = this.attempts.get(userId) || { count: 0, lastAttempt: 0 };
      userAttempts.count++;
      userAttempts.lastAttempt = Date.now();
      this.attempts.set(userId, userAttempts);
    }
  }
}
```

## Authentication Flow Examples

### 1. Complete Authentication Flow

```javascript
class ChipiPayAuthenticatedClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://your-domain.com/api';
  }

  async authenticatedRequest(endpoint, data) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new AuthenticationError(error.error.code, error.error.message);
    }

    return await response.json();
  }

  async transfer(pin, recipient, amount) {
    return await this.authenticatedRequest('/merchants/wallet/transfer', {
      pin,
      recipient,
      amount
    });
  }
}

class AuthenticationError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = 'AuthenticationError';
  }
}
```

### 2. Secure PIN Handling

```javascript
class SecurePinHandler {
  constructor() {
    this.pinCache = new Map();
    this.cacheTimeout = 300000; // 5 minutes
  }

  async getPin(userId, promptMessage = 'Enter your PIN:') {
    // Check if we have a cached PIN
    const cached = this.pinCache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.pin;
    }

    // Prompt user for PIN
    const pin = await this.promptForPin(promptMessage);
    
    // Validate PIN format
    this.validatePin(pin);

    // Cache PIN temporarily
    this.pinCache.set(userId, {
      pin: pin,
      timestamp: Date.now()
    });

    // Clear cache after timeout
    setTimeout(() => {
      this.pinCache.delete(userId);
    }, this.cacheTimeout);

    return pin;
  }

  validatePin(pin) {
    if (!pin || typeof pin !== 'string') {
      throw new Error('PIN is required');
    }

    if (pin.length < 4 || pin.length > 8) {
      throw new Error('PIN must be 4-8 characters long');
    }

    if (!/^[a-zA-Z0-9]+$/.test(pin)) {
      throw new Error('PIN must contain only letters and numbers');
    }
  }

  async promptForPin(message) {
    // Implementation depends on your UI framework
    // This is a placeholder for the actual PIN input mechanism
    return await this.showPinDialog(message);
  }

  clearPinCache(userId) {
    this.pinCache.delete(userId);
  }
}
```

### 3. Error Handling and Retry Logic

```javascript
class AuthenticationManager {
  constructor(apiKey, maxRetries = 3) {
    this.client = new ChipiPayAuthenticatedClient(apiKey);
    this.pinHandler = new SecurePinHandler();
    this.maxRetries = maxRetries;
  }

  async executeWalletOperation(userId, operation, ...args) {
    let attempts = 0;

    while (attempts < this.maxRetries) {
      try {
        const pin = await this.pinHandler.getPin(userId);
        return await operation(pin, ...args);
      } catch (error) {
        attempts++;

        if (error.code === 'INVALID_PIN') {
          // Clear cached PIN and try again
          this.pinHandler.clearPinCache(userId);
          
          if (attempts < this.maxRetries) {
            continue;
          } else {
            throw new Error('Maximum PIN attempts exceeded');
          }
        } else if (error.code === 'UNAUTHORIZED') {
          throw new Error('Invalid API key or expired session');
        } else {
          // For other errors, don't retry
          throw error;
        }
      }
    }
  }

  async transfer(userId, recipient, amount) {
    return await this.executeWalletOperation(
      userId,
      (pin) => this.client.transfer(pin, recipient, amount)
    );
  }

  async approve(userId, contractAddress, spender, amount) {
    return await this.executeWalletOperation(
      userId,
      (pin) => this.client.approve(pin, contractAddress, spender, amount)
    );
  }
}
```

## Testing Authentication

### 1. Unit Tests for Authentication

```javascript
describe('ChipiPay Authentication', () => {
  let authManager;

  beforeEach(() => {
    authManager = new AuthenticationManager('pk_test_123456');
  });

  test('should authenticate with valid API key', async () => {
    const mockResponse = { success: true, data: { txHash: '0x123' } };
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    const result = await authManager.transfer('user1', '0xrecipient', '100');
    expect(result.success).toBe(true);
  });

  test('should handle invalid PIN error', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: { code: 'INVALID_PIN', message: 'Invalid PIN' }
      })
    });

    await expect(authManager.transfer('user1', '0xrecipient', '100'))
      .rejects.toThrow('Invalid PIN');
  });

  test('should handle unauthorized error', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: { code: 'UNAUTHORIZED', message: 'Invalid API key' }
      })
    });

    await expect(authManager.transfer('user1', '0xrecipient', '100'))
      .rejects.toThrow('Invalid API key');
  });
});
```

### 2. Integration Tests

```javascript
describe('ChipiPay Authentication Integration', () => {
  test('should complete authenticated transfer', async () => {
    const authManager = new AuthenticationManager(process.env.CHIPIPAY_API_KEY_TESTNET);
    
    // Mock PIN input
    jest.spyOn(authManager.pinHandler, 'promptForPin')
      .mockResolvedValue('123456');

    const result = await authManager.transfer(
      'test-user',
      '0x1234567890abcdef...',
      '0.001'
    );

    expect(result.success).toBe(true);
    expect(result.data.txHash).toMatch(/^0x[a-fA-F0-9]+$/);
  });
});
```

## Troubleshooting Authentication Issues

### Common Authentication Errors

#### 1. Invalid API Key (401 Unauthorized)
```
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing API key"
  }
}
```

**Solutions:**
- Verify API key is correct and not expired
- Check API key format (should start with `pk_test_` or `pk_prod_`)
- Ensure API key matches the environment (testnet/mainnet)
- Verify Authorization header format: `Bearer pk_test_...`

#### 2. Invalid PIN (401 Unauthorized)
```
{
  "success": false,
  "error": {
    "code": "INVALID_PIN",
    "message": "PIN is incorrect or cannot decrypt wallet"
  }
}
```

**Solutions:**
- Verify PIN is correct
- Check PIN format (4-8 alphanumeric characters)
- Ensure wallet was created successfully during registration
- Try resetting PIN if available

#### 3. Rate Limit Exceeded (429 Too Many Requests)
```
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later"
  }
}
```

**Solutions:**
- Implement exponential backoff
- Reduce request frequency
- Check rate limit headers in response
- Consider caching responses where appropriate

### Debugging Authentication

#### 1. Enable Debug Logging
```javascript
class DebugAuthClient extends ChipiPayAuthenticatedClient {
  async authenticatedRequest(endpoint, data) {
    console.log(`Making request to ${endpoint}`);
    console.log(`API Key: ${this.apiKey.substring(0, 10)}...`);
    console.log(`Request data:`, { ...data, pin: '[REDACTED]' });

    try {
      const result = await super.authenticatedRequest(endpoint, data);
      console.log(`Request successful:`, result);
      return result;
    } catch (error) {
      console.error(`Request failed:`, error);
      throw error;
    }
  }
}
```

#### 2. Validate Configuration
```javascript
function validateAuthConfiguration() {
  const apiKey = process.env.CHIPIPAY_API_KEY;
  
  if (!apiKey) {
    throw new Error('CHIPIPAY_API_KEY environment variable is required');
  }

  if (!apiKey.startsWith('pk_test_') && !apiKey.startsWith('pk_prod_')) {
    throw new Error('Invalid API key format');
  }

  if (apiKey.length < 20) {
    throw new Error('API key appears to be too short');
  }

  console.log('✅ Authentication configuration is valid');
}
```

## Security Checklist

### API Key Security
- [ ] API keys stored in environment variables, not code
- [ ] Different keys used for testnet and mainnet
- [ ] API keys rotated regularly
- [ ] API key access limited to necessary personnel
- [ ] API key usage monitored for anomalies

### PIN Security
- [ ] PINs never stored in plain text
- [ ] PIN format validation implemented
- [ ] PIN attempt limiting in place
- [ ] PIN cache cleared after timeout
- [ ] PIN input secured (no logging, no storage)

### Network Security
- [ ] All API calls use HTTPS
- [ ] Request/response data validated
- [ ] Rate limiting implemented
- [ ] Error messages don't leak sensitive information
- [ ] Authentication errors logged for monitoring

### Monitoring
- [ ] Authentication success/failure rates tracked
- [ ] Unusual authentication patterns detected
- [ ] Failed authentication attempts logged
- [ ] API key usage monitored
- [ ] Alerts configured for authentication anomalies

This authentication guide provides the foundation for secure integration with ChipiPay's wallet operations. Follow these practices to ensure your application maintains the highest security standards while providing a smooth user experience.