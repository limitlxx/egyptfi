# Swap Service Documentation

## Overview

The `SwapService` class provides a backend service for executing atomic swaps between Bitcoin (BTC/BTC Lightning Network), STRK (Starknet native token), and USDC on the Starknet blockchain. It leverages the Atomiq SDK for cross-chain swaps and the AutoSwappr SDK for on-chain Starknet token exchanges. The service handles both inbound (BTC/BTC LN → STRK/USDC) and outbound (STRK/USDC → BTC/BTC LN) swaps, including payment processing, claiming, and token transfers.

Key features:
- **Cross-chain swaps**: BTC/BTC LN to STRK via atomic swaps.
- **On-chain swaps**: STRK to USDC using a DEX-like mechanism (AutoSwappr).
- **Automated claiming**: Polls for claimable swaps and processes them with retry logic.
- **Token transfers**: Post-swap transfers to user addresses on Starknet.
- **Storage**: Uses SQLite for swap state and associations (expandable to production DB like Redis/Postgres).

**Dependencies**:
- `@atomiqlabs/sdk`: Core swapper factory and token handling.
- `@atomiqlabs/chain-starknet`: Starknet signer and initializer.
- `@atomiqlabs/storage-sqlite`: SQLite-based storage for swaps.
- `autoswap-sdk`: On-chain STRK ↔ USDC swapping.
- `starknet`: RPC provider and account interface.

**Environment Variables**:
- `NEXT_PUBLIC_USDC_CONTRACT_ADDRESS`: USDC contract address on Starknet.
- `STARKNET_RPC_URL`: Starknet RPC endpoint (e.g., `https://starknet-mainnet.public.blastapi.io`).
- `WALLET_SECRET_KEY`: Private key for backend Starknet wallet (used for signing).
- `AUTOSWAPPR_CONTRACT_ADDRESS`: AutoSwappr DEX contract address.
- `BACKEND_PRIVATE_KEY`: Private key for AutoSwappr (may differ from wallet key).

**Assumptions**:
- Bitcoin network: Mainnet.
- STRK address: Fixed as `0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d`.
- Swap associations are stored transiently (placeholders); implement persistent storage in production.
- Error handling is basic; enhance with monitoring (e.g., Sentry).

## Interfaces

### `SwapRequest`
Input parameters for initiating a swap.

| Property       | Type    | Description                                                                 | Required? |
|----------------|---------|-----------------------------------------------------------------------------|-----------|
| `tokenIn`      | `string` | Input token symbol (e.g., `'BTC'`, `'BTCLN'`, `'STRK'`) or address (Starknet tokens). | Yes      |
| `tokenOut`     | `string` | Output token symbol (e.g., `'BTC'`, `'BTCLN'`, `'STRK'`, USDC address).     | Yes      |
| `amount`       | `string` | Human-readable input amount (e.g., `'0.001'`). Converted to BigInt internally. | Yes      |
| `accountAddress` | `string` | User's Starknet address (final destination for STRK/USDC).                  | Yes      |
| `destAddress`  | `string`? | Optional BTC/BTC LN destination (address, invoice, or LNURL). Required for outbound swaps to BTC. | No       |

### `SwapResponse`
Output from swap execution.

| Property       | Type    | Description                                                                 |
|----------------|---------|-----------------------------------------------------------------------------|
| `success`      | `boolean` | Whether the swap initiated successfully.                                    |
| `paymentAddress`? | `string` | BTC payment address (for BTC inbound swaps).                                |
| `invoice`?     | `string` | Lightning invoice (for BTCLN inbound swaps).                                |
| `hyperlink`?   | `string` | Payment hyperlink for user convenience.                                     |
| `swapId`?      | `string` | Unique swap ID for tracking.                                                |
| `status`?      | `string` | Initial status (e.g., `'waiting_payment'`).                                 |
| `txHash`?      | `string` | Starknet transaction hash (for on-chain swaps) or Bitcoin TX ID/secret.     |
| `error`?       | `string` | Error message if `success` is `false`.                                      |

## Class: `SwapService`

### Constructor
Initializes the swapper, Starknet signer, and storage.

```typescript
constructor()
```

- **Provider Setup**: Creates an RPC provider and keypair wallet from env vars.
- **Signer**: Instantiates `StarknetSigner` for transaction signing.
- **Swapper Factory**: Configures `SwapperFactory` with Starknet initializer, Bitcoin Mainnet, and SQLite storage.
- **Initialization**: Calls `swapper.init()` asynchronously (errors logged).

**Usage**:
```typescript
const service = new SwapService();
```

### `executeSwap(req: SwapRequest): Promise<SwapResponse>`
Executes a swap based on the request. Handles three flow types:

1. **Inbound (BTC/BTC LN → STRK/USDC)**:
   - Creates an atomic swap using `swapper.swap()`.
   - Generates payment details (address/invoice/hyperlink).
   - Stores user association (placeholder).
   - Returns payment info for user to send funds.

2. **Outbound (STRK → BTC/BTC LN)**:
   - Requires `destAddress`.
   - Initiates swap with `swapper.withChain().swap()`, commits, and waits for payment.
   - Refunds on failure.
   - Returns success and TX/secret.

3. **On-Chain (STRK → USDC)**:
   - Uses `AutoSwappr` for DEX swap.
   - Transfers output USDC to user address.
   - Returns transaction hash.

**Error Handling**: Catches and logs errors, returns `{ success: false, error: message }`.

**Example**:
```typescript
const req: SwapRequest = {
  tokenIn: 'BTC',
  tokenOut: 'STRK',
  amount: '0.001',
  accountAddress: '0x123...',
};
const response = await service.executeSwap(req);
if (response.success) {
  // Instruct user to pay to response.paymentAddress
}
```

### `processPendingSwaps(): Promise<void>`
Background task to poll and process claimable inbound swaps.

- Fetches claimable swaps via `swapper.getClaimableSwaps()`.
- For each:
  - Retrieves user association (placeholder).
  - Retries claiming (up to 3x with exponential backoff: 1s, 2s, 4s).
  - Commits, claims, and waits for completion.
  - Handles output:
    - If USDC: Swaps STRK → USDC via AutoSwappr, then transfers.
    - If STRK: Direct transfer.
  - Refunds on max retries.
  - Cleans up association.

**Usage**: Call periodically (e.g., via cron job every 30s) in a server loop.

**Example**:
```typescript
setInterval(() => service.processPendingSwaps(), 30000);
```

### Private Methods

#### `transferToken(tokenAddress: string, amountStr: string, toAddress: string): Promise<void>`
Transfers a token (STRK or USDC) from backend wallet to user address.

- Converts amount to low/high calldata (Starknet's 128-bit split).
- Executes `transfer` entrypoint.
- Logs TX hash.

**Note**: Does not wait for confirmation; add in production.

#### `getTokenSymbolObj(symbol: string): any`
Maps symbol to Atomiq token object for amount conversion.

- Supports `'BTC'`, `'BTCLN'`, `'STRK'`.
- Throws on unsupported tokens.

#### Storage Placeholders
- `storeSwapAssociation(swapId: string, data: any)`: Logs association (implement DB insert).
- `getSwapAssociation(swapId: string): any`: Returns null (implement DB query).
- `removeSwapAssociation(swapId: string)`: Logs removal (implement DB delete).

**Production Tip**: Use a real DB schema:
```sql
CREATE TABLE swap_associations (
  swap_id TEXT PRIMARY KEY,
  user_address TEXT NOT NULL,
  token_out TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Usage in a Next.js API Route

Example `/api/swap` endpoint:

```typescript
import { SwapService } from '@/lib/swap-service';

let service: SwapService | null = null;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!service) service = new SwapService();
  
  if (req.method === 'POST') {
    const reqBody: SwapRequest = req.body;
    const result = await service.executeSwap(reqBody);
    res.status(result.success ? 200 : 400).json(result);
  } else if (req.method === 'GET' && req.query.process === 'pending') {
    await service.processPendingSwaps();
    res.status(200).json({ message: 'Processed' });
  }
}
```

## Limitations & Improvements
- **Slippage/Exact Amounts**: Inbound swaps use exactIn; adjust for fees/slippage.
- **Gas Estimation**: Not handled; integrate Starknet's `estimateFee`.
- **Security**: Protect private keys (use HSM/KMS). Validate inputs rigorously.
- **Monitoring**: Add metrics for swap success rates, delays.
- **Testing**: Unit test with mocks; integration with testnet.
- **Supported Pairs**: BTC/BTCLN ↔ STRK, STRK ↔ USDC. Extend via SDK.

For issues, refer to SDK docs: [Atomiq SDK](https://docs.atomiq.xyz), [Starknet](https://docs.starknet.io).