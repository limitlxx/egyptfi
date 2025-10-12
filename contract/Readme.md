# EgyptFi Smart Contract Documentation

## Overview

The **EgyptFi** contract is a comprehensive payment processing and yield optimization platform built on Starknet. It enables merchants to register, manage KYC proofs, process USDC payments, handle withdrawals and refunds, and automatically allocate funds across multiple yield-generating pools (e.g., Vesu pools) for optimized returns. The contract supports multi-pool strategies where merchants can customize allocations (in basis points) for depositing net payments into various liquidity pools, with the remainder held in a vault for liquidity.

Key features:
- **Merchant Management**: Registration, updates, deactivation, and metadata handling.
- **KYC Integration**: Merchants can set and verify proof hashes for compliance.
- **Payment Processing**: Create, process, and verify payments with platform fees.
- **Yield Optimization**: Automatic distribution of funds to multiple pools; claim or compound yields.
- **Admin Controls**: Emergency pause, fee updates, pool registry, and platform fee management.
- **Security**: Uses OpenZeppelin components for ownership, reentrancy protection, and upgradability.
- **Token**: Primarily handles USDC (ERC20) for payments and transfers.

The contract interacts with external Vesu pools via the `IVesuPool` interface for deposits, redemptions, and yield calculations.

**Deployment Notes**:
- Upgradable via OpenZeppelin.
- Assumes USDC is pre-approved for transfers.
- All percentages are in basis points (e.g., 10000 = 100%).

## Custom Types

### Structs

#### `Merchant`
Represents a registered merchant's state.

```rust
#[derive(Drop, Serde, Copy, starknet::Store)]
struct Merchant {
    is_active: bool, 
    usdc_balance: u256,  // Vault balance (non-pooled funds)
    total_payments_received: u256,  // Cumulative net USDC received
    total_payments_count: u64,  // Total payments processed
    withdrawal_address: ContractAddress,  // Address for withdrawals
    metadata_hash: felt252,  // IPFS or similar hash for merchant metadata
    joined_timestamp: u64,  // Registration timestamp
}
```

#### `Payment`
Tracks individual payment details.

```rust
#[derive(Drop, Serde, Copy, starknet::Store)]
struct Payment {
    payment_id: felt252,  // Unique Poseidon hash-based ID
    merchant: ContractAddress,
    customer: ContractAddress,
    amount_paid: u256,  // Input amount (e.g., in native tokens, but treated as USDC equivalent)
    usdc_amount: u256,  // Actual USDC settled
    platform_fee: u256,  // Fee deducted
    status: PaymentStatus,
    timestamp: u64,
    reference: felt252,  // Unique reference for the payment
    description: felt252,  // Optional description
}
```

#### `PoolInfo`
Details of a registered yield pool.

```rust
#[derive(Drop, Serde, Copy, starknet::Store)]
struct PoolInfo {
    pool_id: felt252,  // Unique identifier
    pool_address: ContractAddress,  // Vesu pool contract address
    pool_name: felt252,  // Human-readable name (e.g., 'Re7')
    pool_type: felt252,  // Type (e.g., 'Stablecoin', 'ETH')
    is_active: bool,
}
```

### Enums

#### `PaymentStatus`
Payment lifecycle states.

```rust
#[derive(Copy, Drop, Serde, PartialEq, starknet::Store)]
enum PaymentStatus {
    Pending,
    Completed,
    Refunded,
    Failed,
}
```

## Storage

The contract uses a `Storage` struct with maps for efficient access:

- `merchants: Map<ContractAddress, Merchant>` – Merchant data.
- `payments: Map<felt252, Payment>` – Payment records.
- `merchant_payments: Map<(ContractAddress, u64), felt252>` – Indexed payment IDs per merchant.
- `merchant_payment_count: Map<ContractAddress, u64>` – Payment count per merchant.
- `setKycProof: Map<ContractAddress, felt252>` – KYC proof hashes.
- `usdc_token: ContractAddress` – USDC contract address.
- `platform_fee_percentage: u16` – Fee in basis points (default/max: 500 = 5%).
- `platform_fee_collector: ContractAddress` – (Unused in current impl; fees go to vault/pool).
- `min_payment_amount_usd: u256` – Minimum payment threshold.
- `emergency_pause: bool` – Global pause flag.
- **Multi-Pool Storage**:
  - `merchant_pool_allocations: Map<(ContractAddress, felt252), u16>` – Allocation % per pool (basis points).
  - `merchant_active_pools: Map<(ContractAddress, u64), felt252>` – Active pool IDs per merchant (indexed).
  - `merchant_active_pool_count: Map<ContractAddress, u64>` – Count of active pools.
  - `merchant_pool_deposits: Map<(ContractAddress, felt252), u256>` – Principal deposited per pool.
  - `merchant_pool_shares: Map<(ContractAddress, felt252), u256>` – vToken shares held per pool.
  - `merchant_pool_yield: Map<(ContractAddress, felt252), u256>` – Unclaimed yield (legacy; now real-time via pool queries).
- **Pool Registry**:
  - `supported_pools: Map<felt252, PoolInfo>` – Pool details.
  - `pool_count: u64` – Total registered pools.
  - `pool_active: Map<felt252, bool>` – Pool activation status.
  - `pool_ids: Map<u64, felt252>` – Indexed pool IDs for iteration.
- **Platform Fee Handling**:
  - `platform_vault_balance: u256` – Accumulated fees in vault.
  - `platform_pool_id: felt252` – Pool for platform fee allocation.
  - `platform_pool_allocation: u16` – % of fees to pool (basis points; default: 5000 = 50%).
  - `platform_pool_deposits: Map<felt252, u256>` – Platform principal per pool.
  - `platform_pool_shares: Map<felt252, u256>` – Platform shares per pool.
- Substorages: `ownable`, `reentrancy_guard`, `upgradeable` (OpenZeppelin).

## Events

Emitted for key actions (all derive from `Event` enum):

- `MerchantRegistered(merchant: ContractAddress, timestamp: u64)`
- `MerchantUpdated(merchant: ContractAddress, field: felt252, timestamp: u64)`
- `PaymentCreated(payment_id: felt252, merchant: ContractAddress, customer: ContractAddress, amount: u256, reference: felt252)`
- `PaymentCompleted(payment_id: felt252, merchant: ContractAddress, customer: ContractAddress, usdc_amount: u256, timestamp: u64)`
- `PaymentRefunded(payment_id: felt252, merchant: ContractAddress, customer: ContractAddress, refund_amount: u256, timestamp: u64)`
- `WithdrawalMade(merchant: ContractAddress, amount: u256, to_address: ContractAddress, timestamp: u64)`
- `EmergencyPauseToggled(paused: bool, timestamp: u64)`
- `PoolRegistered(pool_id: felt252, pool_address: ContractAddress, pool_name: felt252, timestamp: u64)`
- `MultiPoolAllocationSet(merchant: ContractAddress, pool_id: felt252, allocation_percentage: u16, timestamp: u64)`
- `PoolActivated(merchant: ContractAddress, pool_id: felt252, timestamp: u64)` (Note: Used for addition)
- `PoolDeactivated(merchant: ContractAddress, pool_id: felt252, timestamp: u64)`
- `YieldDeposited(merchant: ContractAddress, amount: u256, pool_id: felt252, timestamp: u64)`
- `YieldClaimed(merchant: ContractAddress, amount: u256, timestamp: u64)`
- `YieldCompounded(merchant: ContractAddress, pool_id: felt252, amount: u256, timestamp: u64)`
- OpenZeppelin events: `OwnableEvent`, `ReentrancyGuardEvent`, `UpgradeableEvent`.

## Constructor

```rust
fn constructor(
    ref self: ContractState,
    owner: ContractAddress,
    usdc_token: ContractAddress,
    platform_fee_percentage: u16,
    platform_fee_collector: ContractAddress,
    min_payment_amount_usd: u256,
)
```
Initializes ownership, USDC token, fee percentage, collector, min amount, and sets pause to `false`. Platform pool allocation defaults to 50%.

## Interfaces

### `IEgyptFi<TContractState>`
Main interface for all user/admin interactions.

#### Merchant Management
- `register_merchant(withdrawal_address: ContractAddress, metadata_hash: felt252)`: Registers caller as merchant. Emits `MerchantRegistered`.
- `update_merchant_withdrawal_address(new_withdrawal_address: ContractAddress)`: Updates withdrawal address. Emits `MerchantUpdated`.
- `update_merchant_metadata(new_metadata_hash: felt252)`: Updates metadata hash. Emits `MerchantUpdated`.
- `deactivate_merchant()`: Deactivates caller. Emits `MerchantUpdated`.

#### KYC Management
- `set_kyc_proof(proof_hash: felt252)`: Sets KYC proof for caller. Emits `MerchantUpdated`.
- `get_kyc_proof(merchant: ContractAddress) -> felt252`: Retrieves proof hash.
- `verify_kyc_proof(merchant: ContractAddress, proof_hash: felt252) -> bool`: Checks if provided hash matches stored (non-zero).

#### Payment Processing
- `create_payment(merchant: ContractAddress, amount: u256, platform_fee: u256, reference: felt252, description: felt252) -> felt252`: Creates pending payment with generated ID. Emits `PaymentCreated`.
- `process_payment(payment_id: felt252)`: Settles payment: Transfers USDC, deducts fee, distributes net to pools/vault, handles platform fee split. Emits `PaymentCompleted`.

#### Withdrawal & Refunds
- `withdraw_funds(amount: u256)`: Withdraws from vault to withdrawal address. Emits `WithdrawalMade`.
- `refund_payment(payment_id: felt252)`: Refunds completed payment proportionally from vault/pools (yield to platform). Emits `PaymentRefunded`.

#### View Functions
- `get_merchant(merchant: ContractAddress) -> Merchant`: Retrieves merchant data.
- `get_payment(payment_id: felt252) -> Payment`: Retrieves payment data.
- `get_merchant_payments(merchant: ContractAddress, offset: u64, limit: u64) -> Array<felt252>`: Paginated payment IDs.
- `verify_payment(payment_id: felt252, merchant: ContractAddress) -> bool`: Checks if payment is valid and completed for merchant.
- `is_paused() -> bool`: Checks emergency pause.

#### Admin Functions
- `toggle_emergency_pause()`: Toggles global pause. Emits `EmergencyPauseToggled`.
- `update_platform_fee(new_fee_percentage: u16)`: Updates fee (max 5%).
- `update_min_payment_amount(new_min_amount: u256)`: Updates min payment.

#### Pool Registry Management (Admin)
- `register_pool(pool_id: felt252, pool_address: ContractAddress, pool_name: felt252, pool_type: felt252)`: Registers new pool. Emits `PoolRegistered`.
- `deactivate_pool(pool_id: felt252)`: Deactivates pool.
- `get_pool_info(pool_id: felt252) -> PoolInfo`: Retrieves pool details.
- `get_all_pools() -> Array<PoolInfo>`: Lists all pools.

#### Merchant Multi-Pool Allocation
- `set_multi_pool_allocation(pool_allocations: Array<(felt252, u16)>)`: Sets multiple allocations (total ≤ 100%). Emits `MultiPoolAllocationSet` per pool.
- `add_pool_to_strategy(pool_id: felt252, allocation_percentage: u16)`: Adds single pool. Emits `PoolActivated`.
- `remove_pool_from_strategy(pool_id: felt252)`: Removes pool (if no deposits). Emits `PoolDeactivated`.
- `update_pool_allocation(pool_id: felt252, new_allocation: u16)`: Updates single allocation. Emits `MultiPoolAllocationSet`.

#### Yield Management
- `get_merchant_pools(merchant: ContractAddress) -> Array<felt252>`: Active pool IDs.
- `get_merchant_pool_allocation(merchant: ContractAddress, pool_id: felt252) -> u16`: Allocation %.
- `get_multi_pool_positions(merchant: ContractAddress) -> Array<(felt252, u256, u256)>`: (pool_id, deposited, yield) per pool.
- `claim_yield_from_pool(pool_id: felt252)`: Claims yield to vault. Emits `YieldClaimed`.
- `claim_all_yields()`: Claims all yields to vault. Emits `YieldClaimed` per pool.
- `compound_pool_yield(pool_id: felt252)`: Compounds yield back to pool. Emits `YieldCompounded`.
- `compound_all_yields()`: Compounds all yields. Emits `YieldCompounded` per pool.

#### Platform Functions (Admin)
- `set_platform_pool_id(pool_id: felt252)`: Sets pool for platform fees.
- `update_platform_pool_allocation(allocation_bp: u16)`: Updates % to pool (≤ 100%).
- `admin_withdraw_fees(amount: u256, to: ContractAddress)`: Withdraws from platform vault.
- `admin_claim_yield_from_pool(pool_id: felt252)`: Claims platform yield to vault. Emits `YieldClaimed`.
- `admin_redeem_principal_from_pool(pool_id: felt252, to: ContractAddress)`: Redeems principal to target.

### `IVesuPool<TContractState>`
Interface for interacting with Vesu pools (external).

- `deposit(assets: u256, receiver: ContractAddress) -> u256`: Deposits and mints shares.
- `redeem(shares: u256, receiver: ContractAddress, owner: ContractAddress) -> u256`: Burns shares for assets.
- `preview_redeem(assets: u256) -> u256`: Previews shares to burn for assets.
- `convert_to_assets(shares: u256) -> u256`: Converts shares to asset value.

## Internal Functions

- `_assert_not_paused()`: Reverts if paused.
- `_is_merchant_active(merchant: ContractAddress) -> bool`: Checks merchant status.
- `_generate_payment_id(merchant: ContractAddress, customer: ContractAddress, reference: felt252) -> felt252`: Poseidon hash with timestamp.
- Multi-pool internals: `_add_to_active_pools`, `_remove_from_active_pools`, `_calculate_total_allocation`, `_deposit_to_specific_pool`, `_deposit_platform_to_pool`.

## Usage Flow

1. **Admin Setup**: Deploy, register pools, set platform pool/allocations.
2. **Merchant Onboarding**: Register, set KYC, configure pool allocations (total ≤ 100%).
3. **Payment**: Customer creates payment; merchant (or off-chain) processes: USDC transfer → fee split → net to pools/vault.
4. **Yield Handling**: Merchants claim/compound yields periodically.
5. **Withdraw/Refund**: From vault or proportional redemption from pools.
6. **Admin**: Manage fees, pause, withdraw platform funds.

## Security Considerations

- **Reentrancy**: Protected via `ReentrancyGuardComponent`.
- **Access Control**: Ownable for admin; caller checks for merchants.
- **Pause**: Emergency toggle halts non-view functions.
- **Allocations**: Enforced total ≤ 100%; no over-deposits.
- **Refunds**: Proportional; handles yield as extra fee.
- **Upgradability**: Proxy pattern; only owner upgrades.
- **Assumptions**: Pools are trusted (Vesu); no slippage/losses modeled.

For full code, refer to `lib.cairo`. Contact EgyptFi team for audits/updates.