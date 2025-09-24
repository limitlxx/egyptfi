## Usage Documentation

### Setup
1. Install dependencies (see above).
2. Configure `.env.local` with required vars.
3. Run the app: `npm run dev`.
4. For production monitoring: Set up a cron job to call `/api/swap` (GET) every 30s to process pending swaps.

### API Endpoints
- **POST `/api/swap`**:
  - **Body** (JSON):
    ```json
    {
      "tokenIn": "BTC",  // or "BTCLN", "STRK" (address for on-chain)
      "tokenOut": "USDC",  // or "STRK", "BTC", "BTCLN"
      "amount": "0.0001",  // Human-readable (e.g., BTC)
      "accountAddress": "0x123...user_starknet_address",
      "destAddress": "bc1q...btc_address"  // Required for BTC/BTCLN out
    }
    ```
  - **Response** (for sync swaps like STRK → USDC):
    ```json
    {
      "success": true,
      "txHash": "0xabc..."
    }
    ```
  - **Response** (for async like BTC → USDC):
    ```json
    {
      "success": true,
      "paymentAddress": "bc1q...",
      "hyperlink": "bitcoin:bc1q...?...",
      "swapId": "swap_123",
      "status": "waiting_payment"
    }
    ```
  - **Polling**: Client polls `/api/swap` (POST with same body) or use `/api/swap` (GET) to trigger processing. Status updates via logs or extend response with state.

- **GET `/api/swap`** (Process Pending): Triggers `processPendingSwaps()` for monitoring/claiming.

### Swap Flow Examples
1. **BTC → USDC**:
   - POST request returns BTC address/hyperlink and `swapId`.
   - User sends exact BTC amount.
   - Backend detects confirmation (via mempool), claims STRK, swaps to USDC via Autoswappr, transfers USDC to `accountAddress`.
   - Logs: Track via console or integrate ELK stack.

2. **STRK → BTC**:
   - Backend swaps STRK (from hot wallet; fund it separately) to user's `destAddress`.
   - Returns BTC tx ID.

3. **Error Handling Example**:
   - Quote expiry: Retry create swap.
   - Claim fail: 3 retries with backoff (1s, 2s, 4s), then refund.
   - Logs: `"[2025-09-24T12:00:00Z] Claim retry 2/3 for swap_123: Timeout"`.

### Extending for Solana
- Add Solana initializer: `npm i @atomiqlabs/chain-solana`.
- Update Factory: Include `SolanaInitializer`.
- In `executeSwap`: If `tokenIn` starts with Solana symbols (e.g., 'SOL'), create Solana → BTC swap, then chain to STRK/USDC.
- Add env: `SOLANA_RPC_URL`.

### Monitoring & Logging
- All actions log ISO timestamps, swap IDs, states (e.g., `SpvFromBTCSwapState.CLAIM_CLAIMED`).
- States from Atomiq: Monitor via `swap.getState()` in logs.
- Prod: Replace `console` with `winston` for levels/files.

### Limitations & Security
- Custodial on StarkNet (hot wallet); use multisig in prod.
- Amounts approximate post-swap; use exact outputs from Autoswappr.
- Test on TESTNET (set `BitcoinNetwork.TESTNET`).
- No rate limits; add in route.

For issues, check Atomiq docs: [npmjs.com/package/@atomiqlabs/sdk](https://www.npmjs.com/package/@atomiqlabs/sdk). Extend paths as needed!