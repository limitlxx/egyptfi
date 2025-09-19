# ChipiPay Wallet Integration API Documentation

## Overview

This documentation covers the ChipiPay invisible wallet integration API endpoints that enable merchants to perform blockchain operations using their automatically created invisible wallets.

## Authentication

All wallet operation endpoints require authentication using API keys. Include your API key in the request headers:

```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

### API Key Types

- **Testnet API Key**: For testing and development (prefix: `pk_test_`)
- **Mainnet API Key**: For production use (prefix: `pk_prod_`)

### Getting API Keys

API keys are automatically generated during merchant registration and can be retrieved from your merchant dashboard.

## Base URL

- **Testnet**: `https://your-domain.com/api`
- **Mainnet**: `https://your-domain.com/api`

## Wallet Operation Endpoints

### 1. Transfer Tokens

Transfer tokens from your invisible wallet to another address.

**Endpoint**: `POST /api/merchants/wallet/transfer`

**Headers**:
```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

**Request Body**:
```json
{
  "pin": "123456",
  "recipient": "0x1234567890abcdef...",
  "amount": "100.5",
  "contractAddress": "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
  "decimals": 18
}
```

**Parameters**:
- `pin` (string, required): Your 4-8 digit PIN used for wallet encryption
- `recipient` (string, required): Destination wallet address
- `amount` (string, required): Amount to transfer (as string to avoid precision issues)
- `contractAddress` (string, optional): Token contract address (defaults to ETH)
- `decimals` (number, optional): Token decimals (defaults to 18)

**Response**:
```json
{
  "success": true,
  "data": {
    "txHash": "0xabcdef1234567890...",
    "recipient": "0x1234567890abcdef...",
    "amount": "100.5",
    "contractAddress": "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7"
  }
}
```

**Example cURL**:
```bash
curl -X POST https://your-domain.com/api/merchants/wallet/transfer \
  -H "Authorization: Bearer pk_test_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "pin": "123456",
    "recipient": "0x1234567890abcdef...",
    "amount": "100.5"
  }'
```

### 2. Approve Token Spending

Approve another contract to spend tokens on behalf of your wallet.

**Endpoint**: `POST /api/merchants/wallet/approve`

**Request Body**:
```json
{
  "pin": "123456",
  "contractAddress": "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
  "spender": "0xabcdef1234567890...",
  "amount": "1000.0",
  "decimals": 18
}
```

**Parameters**:
- `pin` (string, required): Your wallet PIN
- `contractAddress` (string, required): Token contract address to approve
- `spender` (string, required): Address that will be allowed to spend tokens
- `amount` (string, required): Maximum amount to approve
- `decimals` (number, optional): Token decimals (defaults to 18)

**Response**:
```json
{
  "success": true,
  "data": {
    "txHash": "0xabcdef1234567890...",
    "contractAddress": "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
    "spender": "0xabcdef1234567890...",
    "amount": "1000.0"
  }
}
```

### 3. Stake USDC in VESU

Stake USDC tokens in the VESU protocol for yield generation.

**Endpoint**: `POST /api/merchants/wallet/stake-vesu-usdc`

**Request Body**:
```json
{
  "pin": "123456",
  "amount": "500.0",
  "receiverWallet": "0x1234567890abcdef..."
}
```

**Parameters**:
- `pin` (string, required): Your wallet PIN
- `amount` (string, required): Amount of USDC to stake
- `receiverWallet` (string, required): Wallet address to receive staking rewards

**Response**:
```json
{
  "success": true,
  "data": {
    "txHash": "0xabcdef1234567890...",
    "amount": "500.0",
    "receiverWallet": "0x1234567890abcdef...",
    "stakingContract": "0xvesu_contract_address..."
  }
}
```

### 4. Withdraw from VESU

Withdraw staked USDC and rewards from the VESU protocol.

**Endpoint**: `POST /api/merchants/wallet/withdraw-vesu-usdc`

**Request Body**:
```json
{
  "pin": "123456",
  "amount": "500.0",
  "recipient": "0x1234567890abcdef..."
}
```

**Parameters**:
- `pin` (string, required): Your wallet PIN
- `amount` (string, required): Amount to withdraw
- `recipient` (string, required): Address to receive withdrawn funds

**Response**:
```json
{
  "success": true,
  "data": {
    "txHash": "0xabcdef1234567890...",
    "amount": "500.0",
    "recipient": "0x1234567890abcdef...",
    "withdrawnAmount": "505.25"
  }
}
```

### 5. Generic Contract Call

Call any smart contract function with custom parameters.

**Endpoint**: `POST /api/merchants/wallet/call-contract`

**Request Body**:
```json
{
  "pin": "123456",
  "contractAddress": "0x1234567890abcdef...",
  "entrypoint": "transfer",
  "calldata": [
    "0xrecipient_address...",
    "1000000000000000000",
    "0"
  ]
}
```

**Parameters**:
- `pin` (string, required): Your wallet PIN
- `contractAddress` (string, required): Target contract address
- `entrypoint` (string, required): Function name to call
- `calldata` (array, required): Array of parameters for the function call

**Response**:
```json
{
  "success": true,
  "data": {
    "txHash": "0xabcdef1234567890...",
    "contractAddress": "0x1234567890abcdef...",
    "entrypoint": "transfer",
    "result": "0x1"
  }
}
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": "Additional error details",
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_1234567890"
  }
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `UNAUTHORIZED` | Invalid or missing API key | 401 |
| `INVALID_PIN` | PIN is incorrect or cannot decrypt wallet | 401 |
| `INVALID_PARAMETERS` | Request parameters are invalid | 400 |
| `INSUFFICIENT_BALANCE` | Not enough tokens for transaction | 400 |
| `NETWORK_ERROR` | Blockchain network error | 503 |
| `WALLET_CREATION_FAILED` | Failed to create invisible wallet | 500 |
| `TRANSACTION_FAILED` | Blockchain transaction failed | 500 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |

## Integration Examples

### JavaScript/Node.js Example

```javascript
const axios = require('axios');

class ChipiPayWalletAPI {
  constructor(apiKey, baseUrl = 'https://your-domain.com/api') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  async transfer(pin, recipient, amount, contractAddress = null) {
    try {
      const response = await axios.post(`${this.baseUrl}/merchants/wallet/transfer`, {
        pin,
        recipient,
        amount,
        contractAddress
      }, { headers: this.headers });
      
      return response.data;
    } catch (error) {
      throw new Error(`Transfer failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async approve(pin, contractAddress, spender, amount) {
    try {
      const response = await axios.post(`${this.baseUrl}/merchants/wallet/approve`, {
        pin,
        contractAddress,
        spender,
        amount
      }, { headers: this.headers });
      
      return response.data;
    } catch (error) {
      throw new Error(`Approval failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async stakeVesuUsdc(pin, amount, receiverWallet) {
    try {
      const response = await axios.post(`${this.baseUrl}/merchants/wallet/stake-vesu-usdc`, {
        pin,
        amount,
        receiverWallet
      }, { headers: this.headers });
      
      return response.data;
    } catch (error) {
      throw new Error(`Staking failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }
}

// Usage example
const walletAPI = new ChipiPayWalletAPI('pk_test_your_api_key');

async function example() {
  try {
    // Transfer 100 ETH
    const transferResult = await walletAPI.transfer(
      '123456',
      '0x1234567890abcdef...',
      '100.0'
    );
    console.log('Transfer successful:', transferResult.data.txHash);

    // Approve USDC spending
    const approveResult = await walletAPI.approve(
      '123456',
      '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
      '0xspender_address...',
      '1000.0'
    );
    console.log('Approval successful:', approveResult.data.txHash);

  } catch (error) {
    console.error('Operation failed:', error.message);
  }
}
```

### Python Example

```python
import requests
import json

class ChipiPayWalletAPI:
    def __init__(self, api_key, base_url='https://your-domain.com/api'):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }

    def transfer(self, pin, recipient, amount, contract_address=None):
        payload = {
            'pin': pin,
            'recipient': recipient,
            'amount': amount
        }
        if contract_address:
            payload['contractAddress'] = contract_address

        response = requests.post(
            f'{self.base_url}/merchants/wallet/transfer',
            headers=self.headers,
            json=payload
        )
        
        if response.status_code != 200:
            raise Exception(f"Transfer failed: {response.json().get('error', {}).get('message', 'Unknown error')}")
        
        return response.json()

    def call_contract(self, pin, contract_address, entrypoint, calldata):
        payload = {
            'pin': pin,
            'contractAddress': contract_address,
            'entrypoint': entrypoint,
            'calldata': calldata
        }

        response = requests.post(
            f'{self.base_url}/merchants/wallet/call-contract',
            headers=self.headers,
            json=payload
        )
        
        if response.status_code != 200:
            raise Exception(f"Contract call failed: {response.json().get('error', {}).get('message', 'Unknown error')}")
        
        return response.json()

# Usage example
wallet_api = ChipiPayWalletAPI('pk_test_your_api_key')

try:
    # Transfer tokens
    result = wallet_api.transfer('123456', '0x1234567890abcdef...', '50.0')
    print(f"Transfer successful: {result['data']['txHash']}")
    
    # Call custom contract
    contract_result = wallet_api.call_contract(
        '123456',
        '0x1234567890abcdef...',
        'mint',
        ['0xrecipient...', '1000000000000000000']
    )
    print(f"Contract call successful: {contract_result['data']['txHash']}")
    
except Exception as e:
    print(f"Operation failed: {e}")
```

## Rate Limits

To ensure system stability and fair usage:

- **Per API Key**: 100 requests per minute
- **Per IP Address**: 1000 requests per hour
- **Wallet Operations**: 10 transactions per minute per wallet

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642234567
```

## Security Best Practices

### PIN Security
- Use strong, unique PINs (4-8 digits)
- Never log or store PINs in plain text
- Implement PIN attempt limiting in your application

### API Key Security
- Store API keys securely (environment variables, secure vaults)
- Use different keys for testnet and mainnet
- Rotate keys regularly
- Never expose keys in client-side code

### Transaction Security
- Always validate transaction parameters
- Implement transaction amount limits
- Monitor for unusual transaction patterns
- Use HTTPS for all API calls

## Troubleshooting

### Common Issues

**1. "INVALID_PIN" Error**
- Verify PIN is correct
- Check PIN format (4-8 digits)
- Ensure wallet was created successfully during registration

**2. "INSUFFICIENT_BALANCE" Error**
- Check wallet balance before transactions
- Account for gas fees in balance calculations
- Verify correct token contract address

**3. "NETWORK_ERROR" Error**
- Check Starknet network status
- Verify RPC endpoint connectivity
- Retry with exponential backoff

**4. "UNAUTHORIZED" Error**
- Verify API key is correct and active
- Check API key format and prefix
- Ensure API key matches environment (testnet/mainnet)

### Getting Help

For additional support:
- Check the error message and code
- Review the integration examples
- Contact support with request ID for faster resolution

## Changelog

### Version 1.0.0 (2024-01-15)
- Initial release of ChipiPay wallet integration API
- Support for transfer, approve, stake, withdraw, and contract call operations
- Comprehensive error handling and documentation