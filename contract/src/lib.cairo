use starknet::ContractAddress; 

#[starknet::interface]
pub trait IEgyptFi<TContractState> {
    // Merchant management
    fn register_merchant(
        ref self: TContractState,
        withdrawal_address: ContractAddress,
        metadata_hash: felt252,
    );
    fn update_merchant_withdrawal_address(
        ref self: TContractState,
        new_withdrawal_address: ContractAddress
    );
    fn update_merchant_metadata(
        ref self: TContractState,
        new_metadata_hash: felt252
    );
    fn deactivate_merchant(ref self: TContractState);

    // KYC management
    fn set_kyc_proof(ref self: TContractState, proof_hash: felt252);
    fn get_kyc_proof(self: @TContractState, merchant: ContractAddress) -> felt252;
    fn verify_kyc_proof(self: @TContractState, merchant: ContractAddress, proof_hash: felt252) -> bool;

    // Payment processing
    fn create_payment(
        ref self: TContractState,
        merchant: ContractAddress,
        amount: u256,
        platform_fee: u256,
        reference: felt252,
        description: felt252
    ) -> felt252;
    fn process_payment(ref self: TContractState, payment_id: felt252);
    
    // Withdrawal & refunds
    fn withdraw_funds(ref self: TContractState, amount: u256);
    fn refund_payment(ref self: TContractState, payment_id: felt252);
    
    // View functions
    fn get_merchant(self: @TContractState, merchant: ContractAddress) -> Merchant;
    fn get_payment(self: @TContractState, payment_id: felt252) -> Payment;
    fn get_merchant_payments(
        self: @TContractState, 
        merchant: ContractAddress, 
        offset: u64, 
        limit: u64
    ) -> Array<felt252>;
    fn verify_payment(
        self: @TContractState, 
        payment_id: felt252, 
        merchant: ContractAddress
    ) -> bool;
    
    // Admin functions
    fn toggle_emergency_pause(ref self: TContractState);
    fn update_platform_fee(ref self: TContractState, new_fee_percentage: u16);
    fn update_min_payment_amount(ref self: TContractState, new_min_amount: u256);
    
    // Utility functions
    fn is_paused(self: @TContractState) -> bool;

    // Admin - Pool registry management
    fn register_pool(
        ref self: TContractState,
        pool_id: felt252,
        pool_address: ContractAddress,
        pool_name: felt252,
        pool_type: felt252
    );
    fn deactivate_pool(ref self: TContractState, pool_id: felt252);
    fn get_pool_info(self: @TContractState, pool_id: felt252) -> PoolInfo;
    fn get_all_pools(self: @TContractState) -> Array<PoolInfo>;

    // Merchant - Multi-pool allocation
    fn set_multi_pool_allocation(
        ref self: TContractState,
        pool_allocations: Array<(felt252, u16)> // Array of (pool_id, allocation %)
    );
    fn add_pool_to_strategy(
        ref self: TContractState,
        pool_id: felt252,
        allocation_percentage: u16
    );
    fn remove_pool_from_strategy(ref self: TContractState, pool_id: felt252);
    fn update_pool_allocation(
        ref self: TContractState,
        pool_id: felt252,
        new_allocation: u16
    );

    // View functions
    fn get_merchant_pools(
        self: @TContractState,
        merchant: ContractAddress
    ) -> Array<felt252>; // Returns array of active pool IDs

    fn get_merchant_pool_allocation(
        self: @TContractState,
        merchant: ContractAddress,
        pool_id: felt252
    ) -> u16;

    fn get_multi_pool_positions(
        self: @TContractState,
        merchant: ContractAddress
    ) -> Array<(felt252, u256, u256)>; // Array of (pool_id, deposited, yield)

    fn claim_yield_from_pool(ref self: TContractState, pool_id: felt252);
    fn claim_all_yields(ref self: TContractState);
    fn compound_pool_yield(ref self: TContractState, pool_id: felt252);
    fn compound_all_yields(ref self: TContractState); 

    fn set_platform_pool_id(ref self: TContractState, pool_id: felt252);
    fn update_platform_pool_allocation(ref self: TContractState, allocation_bp: u16);
    fn admin_withdraw_fees(ref self: TContractState, amount: u256, to: ContractAddress);
    fn admin_claim_yield_from_pool(ref self: TContractState, pool_id: felt252);
    fn admin_redeem_principal_from_pool(ref self: TContractState, pool_id: felt252, to: ContractAddress);

}

#[starknet::interface]
pub trait IVesuPool<TContractState> {
    fn deposit(
        ref self: TContractState,
        assets: u256,
        receiver: ContractAddress
    ) -> u256;
    fn redeem(
        ref self: TContractState,
        shares: u256,
        receiver: ContractAddress,
        owner: ContractAddress
    ) -> u256;
    fn preview_redeem(
        self: @TContractState,
        assets: u256
    ) -> u256;
    fn convert_to_assets(
        self: @TContractState,
        shares: u256
    ) -> u256;
}

// CustomeTypes
    #[derive(Drop, Serde, Copy, starknet::Store)]
    pub struct Merchant {
        pub is_active: bool, 
        pub usdc_balance: u256,
        pub total_payments_received: u256,
        pub total_payments_count: u64,
        pub withdrawal_address: ContractAddress,
        pub metadata_hash: felt252, // in basis points (10000 = 100%)
        pub joined_timestamp: u64,
    }

    #[derive(Drop, Serde, Copy, starknet::Store)]
    pub struct Payment {
        pub payment_id: felt252,
        pub merchant: ContractAddress,
        pub customer: ContractAddress,
        pub amount_paid: u256,
        pub usdc_amount: u256,
        pub platform_fee: u256,
        pub status: PaymentStatus,
        pub timestamp: u64,
        pub reference: felt252,
        pub description: felt252,
    }


    #[derive(Copy, Drop, Serde, PartialEq, starknet::Store, Debug)]
    #[allow(starknet::store_no_default_variant)]
    pub enum PaymentStatus {
        Pending,
        Completed,
        Refunded,
        Failed,
    }

    #[derive(Drop, Serde, Copy, starknet::Store)]
    pub struct PoolInfo {
        pub pool_id: felt252,
        pub pool_address: ContractAddress,
        pub pool_name: felt252, // e.g., 'Re7', 'Troves'
        pub pool_type: felt252, // e.g., 'Stablecoin', 'ETH'
        pub is_active: bool,
    }

#[starknet::contract]
pub mod EgyptFi {   
    use crate::PoolInfo; 
    use crate::IVesuPoolDispatcher;
    use crate::IVesuPoolDispatcherTrait as IVesuPoolTrait;
    use starknet::storage::{Map, StoragePointerReadAccess, StoragePointerWriteAccess, StorageMapReadAccess, StorageMapWriteAccess};
    use super::{Merchant, Payment, PaymentStatus};
    use super::IEgyptFi;  
    use super::ContractAddress;
    use starknet::get_caller_address;
    use starknet::get_contract_address;
    use starknet::get_block_timestamp;
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_security::ReentrancyGuardComponent;
    use openzeppelin_token::erc20::interface::{IERC20Dispatcher};
    use openzeppelin_token::erc20::interface::IERC20DispatcherTrait as IERC20Trait;
    use openzeppelin_upgrades::UpgradeableComponent; 
    use openzeppelin_upgrades::interface::IUpgradeable;
    use core::traits::Into;
    use core::hash::{HashStateTrait};
    use core::{poseidon::PoseidonTrait};
    use core::num::traits::Zero;
    use starknet::ClassHash;
  

    // Components
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: ReentrancyGuardComponent, storage: reentrancy_guard, event: ReentrancyGuardEvent);
    component!(path: UpgradeableComponent, storage: upgradeable, event: UpgradeableEvent);

    // Ownable Mixin
    #[abi(embed_v0)]
    impl OwnableMixinImpl = OwnableComponent::OwnableMixinImpl<ContractState>;
    impl InternalImpl = OwnableComponent::InternalImpl<ContractState>; 
    impl ReentrancyGuardInternalImpl = ReentrancyGuardComponent::InternalImpl<ContractState>;
    impl UpgradeableInternalImpl = UpgradeableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        merchants: Map<ContractAddress, Merchant>,
        payments: Map<felt252, Payment>,
        merchant_payments: Map<(ContractAddress, u64), felt252>,
        merchant_payment_count: Map<ContractAddress, u64>,
        setKycProof: Map<ContractAddress, felt252>,
        usdc_token: ContractAddress,
        platform_fee_percentage: u16,
        platform_fee_collector: ContractAddress,
        min_payment_amount_usd: u256,
        emergency_pause: bool,

        // Multi-pool support
        merchant_pool_allocations: Map<(ContractAddress, felt252), u16>, // (merchant, pool_id) -> allocation %
        merchant_active_pools: Map<(ContractAddress, u64), felt252>, // (merchant, index) -> pool_id
        merchant_active_pool_count: Map<ContractAddress, u64>, // merchant -> number of active pools
        merchant_pool_deposits: Map<(ContractAddress, felt252), u256>, // (merchant, pool_id) -> deposited amount (principal)
        merchant_pool_shares: Map<(ContractAddress, felt252), u256>, // (merchant, pool_id) -> vToken shares held
        merchant_pool_yield: Map<(ContractAddress, felt252), u256>, // (merchant, pool_id) -> unclaimed yield (legacy, now calculated real-time)
        
        // Pool registry
        supported_pools: Map<felt252, PoolInfo>, // pool_id -> pool info
        pool_count: u64,
        pool_active: Map<felt252, bool>, // pool_id -> is_active
        pool_ids: Map<u64, felt252>, // index -> pool_id 

        // Platform fee handling
        platform_vault_balance: u256,
        platform_pool_id: felt252,
        platform_pool_allocation: u16,  // Basis points (e.g., 5000 = 50%)
        platform_pool_deposits: Map<felt252, u256>,  // pool_id -> principal deposited by platform
        platform_pool_shares: Map<felt252, u256>,    // pool_id -> shares held by platform     

        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
         #[substorage(v0)]
        reentrancy_guard: ReentrancyGuardComponent::Storage,
        #[substorage(v0)]
        upgradeable: UpgradeableComponent::Storage
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        ReentrancyGuardEvent: ReentrancyGuardComponent::Event,
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,

        MerchantRegistered: MerchantRegistered,
        MerchantUpdated: MerchantUpdated,
        PaymentCreated: PaymentCreated,
        PaymentCompleted: PaymentCompleted,
        PaymentRefunded: PaymentRefunded,
        WithdrawalMade: WithdrawalMade,
        EmergencyPauseToggled: EmergencyPauseToggled,
        YieldDeposited: YieldDeposited,
        YieldClaimed: YieldClaimed,
        YieldCompounded: YieldCompounded,
        PoolRegistered: PoolRegistered,
        PoolActivated: PoolActivated,
        PoolDeactivated: PoolDeactivated,
        MultiPoolAllocationSet: MultiPoolAllocationSet,
    }

    #[derive(Drop, starknet::Event)]
    pub struct YieldDeposited {
        pub merchant: ContractAddress,
        pub amount: u256,
        pub pool_id: felt252,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct YieldClaimed {
        pub merchant: ContractAddress,
        pub amount: u256,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct YieldCompounded {
        pub merchant: ContractAddress,
        pub pool_id: felt252,
        pub amount: u256,
        pub timestamp: u64,
    }
 

    #[derive(Drop, starknet::Event)]
    pub struct MerchantRegistered {
        pub merchant: ContractAddress, 
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MerchantUpdated {
        pub merchant: ContractAddress,
        pub field: felt252,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PaymentCreated {
        pub payment_id: felt252,
        pub merchant: ContractAddress,
        pub customer: ContractAddress,
        pub amount: u256,
        pub reference: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PaymentCompleted {
        pub payment_id: felt252,
        pub merchant: ContractAddress,
        pub customer: ContractAddress,
        pub usdc_amount: u256,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PaymentRefunded {
        pub payment_id: felt252,
        pub merchant: ContractAddress,
        pub customer: ContractAddress,
        pub refund_amount: u256,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct WithdrawalMade {
        pub merchant: ContractAddress,
        pub amount: u256,
        pub to_address: ContractAddress,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct EmergencyPauseToggled {
        pub paused: bool,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PoolRegistered {
        pub pool_id: felt252,
        pub pool_address: ContractAddress,
        pub pool_name: felt252,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MultiPoolAllocationSet {
        pub merchant: ContractAddress,
        pub pool_id: felt252,
        pub allocation_percentage: u16,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PoolActivated {
        pub merchant: ContractAddress,
        pub pool_id: felt252,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PoolDeactivated {
        pub merchant: ContractAddress,
        pub pool_id: felt252,
        pub timestamp: u64,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        usdc_token: ContractAddress,
        platform_fee_percentage: u16,
        platform_fee_collector: ContractAddress,
        min_payment_amount_usd: u256,
    ) {
        self.ownable.initializer(owner);
        self.usdc_token.write(usdc_token);
        self.platform_fee_percentage.write(platform_fee_percentage);
        self.platform_fee_collector.write(platform_fee_collector);
        self.min_payment_amount_usd.write(min_payment_amount_usd);
        self.emergency_pause.write(false);

        self.platform_vault_balance.write(0);
        self.platform_pool_id.write(0);  // Admin sets via set_platform_pool_id
        self.platform_pool_allocation.write(5000);  // Default 50% to pool, 50% to vault
    }

     #[abi(embed_v0)]
    impl UpgradeableImpl of IUpgradeable<ContractState> {
        fn upgrade(ref self: ContractState, new_class_hash: ClassHash) {
            self.ownable.assert_only_owner();
            self.upgradeable.upgrade(new_class_hash);
        }
    }
 
 

    #[generate_trait]
    impl InternalFunctions of InternalFunctionsTrait {
        fn _assert_not_paused(self: @ContractState) {
            assert(!self.emergency_pause.read(), 'Contract is paused');
        }

        fn _is_merchant_active(self: @ContractState, merchant: ContractAddress) -> bool {
            self.merchants.read(merchant).is_active
        }

        fn _generate_payment_id(
            self: @ContractState,
            merchant: ContractAddress,
            customer: ContractAddress,
            reference: felt252
        ) -> felt252 { 

            let mut state = PoseidonTrait::new();
            
            let timestamp = get_block_timestamp();
            state = state.update(merchant.into());
            state = state.update(customer.into());
            state = state.update(reference);
            state = state.update(timestamp.into());
            
            state.finalize()          
        }
    }

    #[generate_trait]
    impl InternalMultiPoolFunctions of InternalMultiPoolFunctionsTrait {

        fn _add_to_active_pools(
            ref self: ContractState,
            merchant: ContractAddress,
            pool_id: felt252
        ) {
            let count = self.merchant_active_pool_count.read(merchant);
            let mut exists = false;
            
            let mut i = 0;
            while i != count {
                if self.merchant_active_pools.read((merchant, i)) == pool_id {
                    exists = true;
                    break;
                }
                i += 1;
            };
            
            if !exists {
                self.merchant_active_pools.write((merchant, count), pool_id);
                self.merchant_active_pool_count.write(merchant, count + 1);
            }
        }
    
        fn _remove_from_active_pools(
            ref self: ContractState,
            merchant: ContractAddress,
            pool_id: felt252
        ) {
            let count = self.merchant_active_pool_count.read(merchant);
            let mut found_index: u64 = count; // Initialize with invalid index
            
            // Find the pool
            let mut i = 0;
            while i != count {
                if self.merchant_active_pools.read((merchant, i)) == pool_id {
                    found_index = i;
                    break;
                }
                i += 1;
            };
            
            // If found, shift remaining elements
            if found_index < count {
                let mut j = found_index;
                while j != (count - 1) {
                    let next_pool = self.merchant_active_pools.read((merchant, j + 1));
                    self.merchant_active_pools.write((merchant, j), next_pool);
                    j += 1;
                };
                
                // Clear last element and decrease count
                self.merchant_active_pools.write((merchant, count - 1), 0);
                self.merchant_active_pool_count.write(merchant, count - 1);
            }
        }
        
        fn _calculate_total_allocation(
            self: @ContractState,
            merchant: ContractAddress
        ) -> u16 {
            let pool_ids = self.get_merchant_pools(merchant);
            let mut total: u16 = 0;
            
            let mut i = 0;
            while i != pool_ids.len() {
                let pool_id = *pool_ids.at(i);
                let allocation = self.merchant_pool_allocations.read((merchant, pool_id));
                total += allocation;
                i += 1;
            };
            
            total
        } 
        
        fn _deposit_to_specific_pool(
            ref self: ContractState,
            merchant: ContractAddress,
            pool_id: felt252,
            amount: u256
        ) {
            let pool_info = self.supported_pools.read(pool_id);
            let mut vtoken = IVesuPoolDispatcher { contract_address: pool_info.pool_address };
            let shares_minted = vtoken.deposit(amount, get_contract_address());
            
            let current_shares = self.merchant_pool_shares.read((merchant, pool_id));
            self.merchant_pool_shares.write((merchant, pool_id), current_shares + shares_minted);
            
            let current_deposits = self.merchant_pool_deposits.read((merchant, pool_id));
            self.merchant_pool_deposits.write((merchant, pool_id), current_deposits + amount);
            
            self.emit(YieldDeposited {
                merchant,
                amount,
                pool_id,
                timestamp: get_block_timestamp(),
            });
        }
        
        fn _deposit_platform_to_pool(
            ref self: ContractState,
            pool_id: felt252,
            amount: u256
        ) {
            assert(self.pool_active.read(pool_id), 'Pool not active');
            let pool_info = self.supported_pools.read(pool_id);
            let mut vtoken = IVesuPoolDispatcher { contract_address: pool_info.pool_address };
            let shares_minted = vtoken.deposit(amount, get_contract_address());
            
            let current_shares = self.platform_pool_shares.read(pool_id);
            self.platform_pool_shares.write(pool_id, current_shares + shares_minted);
            
            let current_deposits = self.platform_pool_deposits.read(pool_id);
            self.platform_pool_deposits.write(pool_id, current_deposits + amount);
            
            self.emit(YieldDeposited {
                merchant: get_contract_address(),
                amount,
                pool_id,
                timestamp: get_block_timestamp(),
            });
        }
    }

    #[abi(embed_v0)]
    impl EgyptFiImpl of IEgyptFi<ContractState> {

        fn register_merchant(
            ref self: ContractState, 
            withdrawal_address: ContractAddress,
            metadata_hash: felt252,
        ) {
            self.reentrancy_guard.start();
            let caller = get_caller_address();
            let existing_merchant = self.merchants.read(caller);
            assert(!existing_merchant.is_active, 'Merchant already registered');
            let new_merchant = Merchant {
                is_active: true, 
                usdc_balance: 0,
                total_payments_received: 0,
                total_payments_count: 0,
                withdrawal_address,
                metadata_hash,
                joined_timestamp: get_block_timestamp(),
            };
            self.merchants.write(caller, new_merchant);
            self.emit(MerchantRegistered {
                merchant: caller, 
                timestamp: get_block_timestamp(),
            });
            self.reentrancy_guard.end();
        }

        fn update_merchant_withdrawal_address(
            ref self: ContractState,
            new_withdrawal_address: ContractAddress
        ) {
            self.reentrancy_guard.start();
            let caller = get_caller_address();
            let mut merchant = self.merchants.read(caller);
            assert(merchant.is_active, 'Merchant not found');
            merchant.withdrawal_address = new_withdrawal_address;
            self.merchants.write(caller, merchant);
            self.emit(MerchantUpdated {
                merchant: caller,
                field: 'withdrawal_address',
                timestamp: get_block_timestamp(),
            });
            self.reentrancy_guard.end();
        }

        fn update_merchant_metadata(
            ref self: ContractState,
            new_metadata_hash: felt252
        ) {
            self.reentrancy_guard.start();
            let caller = get_caller_address();
            let mut merchant = self.merchants.read(caller);
            assert(merchant.is_active, 'Merchant not found');
            
            merchant.metadata_hash = new_metadata_hash;
            self.merchants.write(caller, merchant);
            
            self.emit(MerchantUpdated {
                merchant: caller,
                field: 'metadata_hash',
                timestamp: get_block_timestamp(),
            });
            self.reentrancy_guard.end();
        }

        fn deactivate_merchant(ref self: ContractState) {
            self.reentrancy_guard.start();
            let caller = get_caller_address();
            let mut merchant = self.merchants.read(caller);
            assert(merchant.is_active, 'Merchant not found');
            merchant.is_active = false;
            self.merchants.write(caller, merchant);
            self.emit(MerchantUpdated {
                merchant: caller,
                field: 'deactivated',
                timestamp: get_block_timestamp(),
            });
            self.reentrancy_guard.end();
        }

        fn set_kyc_proof(ref self: ContractState, proof_hash: felt252) {
            self.reentrancy_guard.start();
            let caller = get_caller_address();
            let merchant = self.merchants.read(caller);
            assert(merchant.is_active, 'Merchant not found');

            self.setKycProof.write(caller, proof_hash);
            self.emit(MerchantUpdated {
                merchant: caller,
                field: 'kyc_proof',
                timestamp: get_block_timestamp(),
            });
            self.reentrancy_guard.end();
        }

        fn get_kyc_proof(self: @ContractState, merchant: ContractAddress) -> felt252 {
            self.setKycProof.read(merchant)
        }

        fn verify_kyc_proof(self: @ContractState, merchant: ContractAddress, proof_hash: felt252) -> bool {
            let stored_proof = self.setKycProof.read(merchant);
            stored_proof == proof_hash && stored_proof != 0
        }

        fn create_payment(
            ref self: ContractState,
            merchant: ContractAddress,
            amount: u256,
            platform_fee: u256,
            reference: felt252,
            description: felt252
        ) -> felt252 {
            self.reentrancy_guard.start();
            self._assert_not_paused();
            let caller = get_caller_address();
            assert(self._is_merchant_active(merchant), 'Merchant not active');
            assert(amount > 0, 'Amount must be positive');
            assert(amount >= self.min_payment_amount_usd.read(), 'Amount below minimum');
            let payment_id = self._generate_payment_id(merchant, caller, reference);
            let payment = Payment {
                payment_id,
                merchant,
                customer: caller,
                amount_paid: amount,
                usdc_amount: 0,
                platform_fee,
                status: PaymentStatus::Pending,
                timestamp: get_block_timestamp(),
                reference,
                description,
            };
            self.payments.write(payment_id, payment);
            let count = self.merchant_payment_count.read(merchant);
            self.merchant_payments.write((merchant, count), payment_id);
            self.merchant_payment_count.write(merchant, count + 1);
            self.emit(PaymentCreated {
                payment_id,
                merchant,
                customer: caller,
                amount,
                reference,
            });
            self.reentrancy_guard.end();
            payment_id
        }

        fn withdraw_funds(ref self: ContractState, amount: u256) {
            self.reentrancy_guard.start();
            self._assert_not_paused();

            let caller = get_caller_address();
            let mut merchant = self.merchants.read(caller);

            assert(merchant.is_active, 'Merchant not found');
            assert(amount > 0, 'Amount must be positive');
            assert(amount <= merchant.usdc_balance, 'Insufficient balance');

            merchant.usdc_balance -= amount;
            self.merchants.write(caller, merchant);

            let usdc_contract = IERC20Dispatcher { contract_address: self.usdc_token.read() };
            usdc_contract.transfer(merchant.withdrawal_address, amount);

            self.emit(WithdrawalMade {
                merchant: caller,
                amount,
                to_address: merchant.withdrawal_address,
                timestamp: get_block_timestamp(),
            });
            self.reentrancy_guard.end();
        } 

        fn refund_payment(ref self: ContractState, payment_id: felt252) {
            self.reentrancy_guard.start();
            self._assert_not_paused();

            let caller = get_caller_address();
            let mut payment = self.payments.read(payment_id);

            assert(payment.payment_id != 0, 'Payment not found');
            assert(payment.merchant == caller, 'Not payment merchant');
            assert(payment.status == PaymentStatus::Completed, 'Payment not completed');

            let merchant = payment.merchant;
            let net_amount = payment.usdc_amount - payment.platform_fee;  // Accurate net (excludes original fee)
            let mut total_refund: u256 = 0;

            // Get current allocations for proportional redemption
            let total_allocation = self._calculate_total_allocation(merchant);
            let vault_allocation_bp = 10000_u16 - total_allocation;  // Basis points for vault portion
            let mut merchant_balance = self.merchants.read(merchant);

            // Withdraw from vault (non-pool remainder)
            let vault_target = net_amount * vault_allocation_bp.into() / 10000_u256;
            assert(merchant_balance.usdc_balance >= vault_target, 'Insufficient vault balance');
            merchant_balance.usdc_balance -= vault_target;
            self.merchants.write(merchant, merchant_balance);
            total_refund += vault_target;

            // Redeem proportionally from each pool (principal to refund, yield to platform vault)
            let pool_ids = self.get_merchant_pools(merchant);
            let mut i = 0;
            while i != pool_ids.len() {
                let pool_id = *pool_ids.at(i);
                let allocation_bp = self.get_merchant_pool_allocation(merchant, pool_id);
                if allocation_bp > 0 {
                    let pool_target = net_amount * allocation_bp.into() / 10000_u256;
                    let pool_deposits = self.merchant_pool_deposits.read((merchant, pool_id));
                    if !pool_deposits.is_zero() {
                        let fraction = pool_target * 10000_u256 / pool_deposits;  // Avoid division loss
                        let shares = self.merchant_pool_shares.read((merchant, pool_id));
                        let shares_to_redeem = (shares * fraction) / 10000_u256;

                        let pool_info = self.supported_pools.read(pool_id);
                        let mut vtoken = IVesuPoolDispatcher { contract_address: pool_info.pool_address };
                        let assets_received = vtoken.redeem(shares_to_redeem, get_contract_address(), get_contract_address());

                        let yield_portion = assets_received - pool_target;
                        if !yield_portion.is_zero() {
                            // Yield from refunded portion goes to platform vault as additional fee
                            self.platform_vault_balance.write(self.platform_vault_balance.read() + yield_portion);
                        }

                        let principal_received = assets_received - yield_portion;
                        total_refund += principal_received;

                        // Update merchant's pool position
                        let remaining_shares = shares - shares_to_redeem;
                        self.merchant_pool_shares.write((merchant, pool_id), remaining_shares);
                        let remaining_deposits = pool_deposits - pool_target;
                        self.merchant_pool_deposits.write((merchant, pool_id), remaining_deposits);
                    }
                }
                i += 1;
            }

            // Transfer net refund to customer (may be slightly less than net_amount if pool losses, but assumes no losses)
            let usdc_contract = IERC20Dispatcher { contract_address: self.usdc_token.read() };
            usdc_contract.transfer(payment.customer, total_refund);

            payment.status = PaymentStatus::Refunded;
            self.payments.write(payment_id, payment);
            self.emit(PaymentRefunded {
                payment_id,
                merchant: payment.merchant,
                customer: payment.customer,
                refund_amount: total_refund,  // Use actual refunded
                timestamp: get_block_timestamp(),
            });
            self.reentrancy_guard.end();
        }

        fn get_merchant(self: @ContractState, merchant: ContractAddress) -> Merchant {
            self.merchants.read(merchant)
        }

        fn get_payment(self: @ContractState, payment_id: felt252) -> Payment {
            self.payments.read(payment_id)
        }

        fn get_merchant_payments(
            self: @ContractState, 
            merchant: ContractAddress, 
            offset: u64, 
            limit: u64
        ) -> Array<felt252> {
            let mut payments = ArrayTrait::new();
            let total_payments = self.merchant_payment_count.read(merchant);
            let end = if offset + limit > total_payments { total_payments } else { offset + limit };
            let mut i = offset;
            let limit = end;
                while i != limit {
                    let payment_id = self.merchant_payments.read((merchant, i));
                    payments.append(payment_id);
                    i += 1;
                };

            payments
        }

        fn verify_payment(
            self: @ContractState, 
            payment_id: felt252, 
            merchant: ContractAddress
        ) -> bool {
            let payment = self.payments.read(payment_id);
            payment.payment_id != 0 && 
            payment.merchant == merchant && 
            payment.status == PaymentStatus::Completed
        }

        fn toggle_emergency_pause(ref self: ContractState) {
            self.ownable.assert_only_owner();
            let current_state = self.emergency_pause.read();
            self.emergency_pause.write(!current_state);
            self.emit(EmergencyPauseToggled {
                paused: !current_state,
                timestamp: get_block_timestamp(),
            });
        }

        fn update_platform_fee(ref self: ContractState, new_fee_percentage: u16) {
            self.ownable.assert_only_owner();
            assert(new_fee_percentage <= 500, 'Fee too high'); // Max 5%
            self.platform_fee_percentage.write(new_fee_percentage);

            //NOTE: no event emitted for platform fee update
        }

        fn update_min_payment_amount(ref self: ContractState, new_min_amount: u256) {
            self.ownable.assert_only_owner();
            self.min_payment_amount_usd.write(new_min_amount);

            //NOTE: no event emitted for min payment amount update
        }

        fn is_paused(self: @ContractState) -> bool {
            self.emergency_pause.read()
        }

        // Register a new pool (admin only)
        fn register_pool(
            ref self: ContractState,
            pool_id: felt252,
            pool_address: ContractAddress,
            pool_name: felt252,
            pool_type: felt252
        ) {
            self.ownable.assert_only_owner();
            
            // Check if pool already exists
            let existing = self.supported_pools.read(pool_id);
            assert(existing.pool_id == 0, 'Pool already registered');
            
            let pool_info = PoolInfo {
                pool_id,
                pool_address,
                pool_name,
                pool_type,
                is_active: true,
            };
            
            self.supported_pools.write(pool_id, pool_info);
            self.pool_active.write(pool_id, true);
            
            // Store pool ID for iteration
            let count = self.pool_count.read();
            self.pool_ids.write(count, pool_id);
            self.pool_count.write(count + 1);
            
            self.emit(PoolRegistered {
                pool_id,
                pool_address,
                pool_name,
                timestamp: get_block_timestamp(),
            });
        }

        // Get all available pools
        fn get_all_pools(self: @ContractState) -> Array<PoolInfo> {
            let mut pools = ArrayTrait::new();
            let total_pools = self.pool_count.read();
            
            let mut i: u64 = 0;
            while i != total_pools {
                let pool_id = self.pool_ids.read(i);
                let pool_info = self.supported_pools.read(pool_id);
                
                if pool_info.pool_id != 0 {
                    pools.append(pool_info);
                }
                
                i += 1;
            };
            
            pools
        }
       
        // Set multiple pool allocations at once
        fn set_multi_pool_allocation(
            ref self: ContractState,
            pool_allocations: Array<(felt252, u16)>
        ) {
            self.reentrancy_guard.start();
            let caller = get_caller_address();
            let merchant = self.merchants.read(caller);
            assert(merchant.is_active, 'Merchant not found');
            
            let mut total_allocation: u16 = 0;
            let mut i = 0;
            
            // Validate total doesn't exceed 100%
            while i != pool_allocations.len() {
                let (pool_id, allocation) = *pool_allocations.at(i);
                
                // Verify pool is active
                assert(self.pool_active.read(pool_id), 'Pool not active');
                
                total_allocation += allocation;
                
                // Update allocation
                self.merchant_pool_allocations.write((caller, pool_id), allocation);
                
                // Add to active pools if not already there
                self._add_to_active_pools(caller, pool_id);
                
                self.emit(MultiPoolAllocationSet {
                    merchant: caller,
                    pool_id,
                    allocation_percentage: allocation,
                    timestamp: get_block_timestamp(),
                });
                
                i += 1;
            };
            
            assert(total_allocation <= 10000, 'Total allocation exceeds 100%');
            
            self.reentrancy_guard.end();
        }

        // Set the pool for platform fee allocation (admin only)
        fn set_platform_pool_id(ref self: ContractState, pool_id: felt252) {
            self.ownable.assert_only_owner();
            assert(self.pool_active.read(pool_id), 'Pool not active');
            self.platform_pool_id.write(pool_id);
        }

        // Update the % of platform fee going to pool vs. vault (admin only)
        fn update_platform_pool_allocation(ref self: ContractState, allocation_bp: u16) {
            self.ownable.assert_only_owner();
            assert(allocation_bp <= 10000, 'Allocation exceeds 100%');
            self.platform_pool_allocation.write(allocation_bp);
        }

        // Admin withdraw from platform vault balance
        fn admin_withdraw_fees(ref self: ContractState, amount: u256, to: ContractAddress) {
            self.ownable.assert_only_owner();
            let current_balance = self.platform_vault_balance.read();
            assert(current_balance >= amount, 'Insufficient platform balance');
            self.platform_vault_balance.write(current_balance - amount);

            let usdc_contract = IERC20Dispatcher { contract_address: self.usdc_token.read() };
            usdc_contract.transfer(to, amount);
        }

        // Admin claim yield from platform's pool position (adds to platform vault)
        fn admin_claim_yield_from_pool(ref self: ContractState, pool_id: felt252) {
            self.ownable.assert_only_owner();
            let shares = self.platform_pool_shares.read(pool_id);
            assert(!shares.is_zero(), 'No position in pool');

            let pool_info = self.supported_pools.read(pool_id);
            let vtoken = IVesuPoolDispatcher { contract_address: pool_info.pool_address };
            let current_assets = vtoken.convert_to_assets(shares);
            let principal = self.platform_pool_deposits.read(pool_id);
            let yield_assets = current_assets - principal;
            assert(!yield_assets.is_zero(), 'No yield to claim');

            let shares_to_burn = vtoken.preview_redeem(yield_assets);
            let assets_received = vtoken.redeem(shares_to_burn, get_contract_address(), get_contract_address());

            let remaining_shares = shares - shares_to_burn;
            self.platform_pool_shares.write(pool_id, remaining_shares);

            // Add to platform vault
            self.platform_vault_balance.write(self.platform_vault_balance.read() + assets_received);

            self.emit(YieldClaimed {
                merchant: get_contract_address(),
                amount: assets_received,
                timestamp: get_block_timestamp(),
            });
        }

        // Admin redeem principal from platform's pool position (sends directly to target)
        fn admin_redeem_principal_from_pool(ref self: ContractState, pool_id: felt252, to: ContractAddress) {
            self.ownable.assert_only_owner();
            let shares = self.platform_pool_shares.read(pool_id);
            assert(!shares.is_zero(), 'No position in pool');

            let pool_info = self.supported_pools.read(pool_id);
            let vtoken = IVesuPoolDispatcher { contract_address: pool_info.pool_address };
            let principal_assets = self.platform_pool_deposits.read(pool_id);  // Redeem original principal worth
            let shares_to_burn = vtoken.preview_redeem(principal_assets);
            let _assets_received = vtoken.redeem(shares_to_burn, to, get_contract_address());

            let remaining_shares = shares - shares_to_burn;
            self.platform_pool_shares.write(pool_id, remaining_shares);
            self.platform_pool_deposits.write(pool_id, 0);  // Reset principal (yield already claimable separately)
        }
            
        // Get all pools for a merchant
        fn get_merchant_pools(
            self: @ContractState,
            merchant: ContractAddress
        ) -> Array<felt252> {
            let mut pools = ArrayTrait::new();
            let count = self.merchant_active_pool_count.read(merchant);
            
            let mut i = 0;
            while i != count {
                let pool_id = self.merchant_active_pools.read((merchant, i));
                if pool_id != 0 {
                    pools.append(pool_id);
                }
                i += 1;
            };
            
            pools
        }
        
        // Get positions across all pools
        fn get_multi_pool_positions(
            self: @ContractState,
            merchant: ContractAddress
        ) -> Array<(felt252, u256, u256)> {
            let mut positions = ArrayTrait::new();
            let pool_ids = self.get_merchant_pools(merchant);
            
            let mut i = 0;
            while i != pool_ids.len() {
                let pool_id = *pool_ids.at(i);
                let deposited = self.merchant_pool_deposits.read((merchant, pool_id));
                let yield_amount = self.merchant_pool_yield.read((merchant, pool_id));
                
                positions.append((pool_id, deposited, yield_amount));
                i += 1;
            };
            
            positions
        }
        
        // Claim all yields across all pools
        fn claim_all_yields(ref self: ContractState) {
            self.reentrancy_guard.start();
            let caller = get_caller_address();
            let mut merchant = self.merchants.read(caller);
            assert(merchant.is_active, 'Merchant not found');
            
            let pool_ids = self.get_merchant_pools(caller);
            let mut total_claimed: u256 = 0;
            
            let mut i = 0;
            while i != pool_ids.len() {
                let pool_id = *pool_ids.at(i);
                let shares = self.merchant_pool_shares.read((caller, pool_id));
                if shares.is_zero() {
                    i += 1;
                    continue;
                }
                
                let pool_info = self.supported_pools.read(pool_id);
                let vtoken = IVesuPoolDispatcher { contract_address: pool_info.pool_address };
                let current_assets = vtoken.convert_to_assets(shares);
                let principal = self.merchant_pool_deposits.read((caller, pool_id));
                let yield_assets = current_assets - principal;
                
                if !yield_assets.is_zero() {
                    let shares_to_burn = vtoken.preview_redeem(yield_assets);
                    let assets_received = vtoken.redeem(shares_to_burn, get_contract_address(), get_contract_address());
                    
                    let remaining_shares = shares - shares_to_burn;
                    self.merchant_pool_shares.write((caller, pool_id), remaining_shares);
                    
                    total_claimed += assets_received;
                    
                    self.emit(YieldClaimed {
                        merchant: caller,
                        amount: assets_received,
                        timestamp: get_block_timestamp(),
                    });
                }
                
                i += 1;
            };
            
            if total_claimed.is_zero() {
                self.reentrancy_guard.end();
                return ();
            }
            
            // Update merchant balance
            merchant.usdc_balance += total_claimed;
            self.merchants.write(caller, merchant);
            
            self.reentrancy_guard.end();
        }
        
        // Compound all yields across all pools
        fn compound_all_yields(ref self: ContractState) {
            self.reentrancy_guard.start();
            let caller = get_caller_address();
            let merchant = self.merchants.read(caller);
            assert(merchant.is_active, 'Merchant not found');
            
            let pool_ids = self.get_merchant_pools(caller);
            let mut total_compounded: u256 = 0;
            
            let mut i = 0;
            while i != pool_ids.len() {
                let pool_id = *pool_ids.at(i);
                let shares = self.merchant_pool_shares.read((caller, pool_id));
                if shares.is_zero() {
                    i += 1;
                    continue;
                }
                
                let pool_info = self.supported_pools.read(pool_id);
                let mut vtoken = IVesuPoolDispatcher { contract_address: pool_info.pool_address };
                let current_assets = vtoken.convert_to_assets(shares);
                let principal = self.merchant_pool_deposits.read((caller, pool_id));
                let yield_assets = current_assets - principal;
                
                if !yield_assets.is_zero() {
                    let shares_to_burn = vtoken.preview_redeem(yield_assets);
                    let assets_received = vtoken.redeem(shares_to_burn, get_contract_address(), get_contract_address());
                    
                    let remaining_shares = shares - shares_to_burn;
                    self.merchant_pool_shares.write((caller, pool_id), remaining_shares);
                    
                    // Reinvest
                    let shares_minted = vtoken.deposit(assets_received, get_contract_address());
                    let updated_shares = remaining_shares + shares_minted;
                    self.merchant_pool_shares.write((caller, pool_id), updated_shares);
                    
                    // Update principal
                    let updated_principal = principal + assets_received;
                    self.merchant_pool_deposits.write((caller, pool_id), updated_principal);
                    
                    total_compounded += assets_received;
                    
                    self.emit(YieldCompounded {
                        merchant: caller,
                        pool_id: pool_id,
                        amount: assets_received,
                        timestamp: get_block_timestamp(),
                    });
                }
                
                i += 1;
            };
            
            if total_compounded.is_zero() {
                self.reentrancy_guard.end();
                return ();
            }
            
            self.reentrancy_guard.end();
        }
        
        // Process payment with multi-pool distribution
        fn process_payment(ref self: ContractState, payment_id: felt252) {
            self.reentrancy_guard.start();
            self._assert_not_paused();

            let caller = get_caller_address();
            let mut payment = self.payments.read(payment_id);
            
            assert(payment.payment_id != 0, 'Payment not found');
            assert(payment.status == PaymentStatus::Pending, 'Payment not pending');
            assert(payment.customer == caller, 'Not payment customer');

            let amount_in = payment.amount_paid;
            let usdc_contract = IERC20Dispatcher { contract_address: self.usdc_token.read() };
            usdc_contract.transfer_from(caller, get_contract_address(), amount_in);

            let usdc_amount = amount_in;
            let platform_fee = usdc_amount * self.platform_fee_percentage.read().into() / 10000;
            let net_amount = usdc_amount - platform_fee;
            
            // Multi-pool distribution
            let pool_ids = self.get_merchant_pools(payment.merchant);
            let mut total_pool_amount: u256 = 0;
            
            let mut i = 0;
            while i != pool_ids.len() {
                let pool_id = *pool_ids.at(i);
                let allocation = self.merchant_pool_allocations.read((payment.merchant, pool_id));
                
                if allocation > 0 {
                    let pool_amount = net_amount * allocation.into() / 10000;
                    total_pool_amount += pool_amount;
                    
                    // Deposit to specific pool
                    self._deposit_to_specific_pool(payment.merchant, pool_id, pool_amount);
                }
                
                i += 1;
            };
            
            // Remaining goes to vault
            let vault_amount = net_amount - total_pool_amount;
            let mut merchant = self.merchants.read(payment.merchant);
            merchant.usdc_balance += vault_amount;
            merchant.total_payments_received += net_amount;
            merchant.total_payments_count += 1;

            self.merchants.write(payment.merchant, merchant);

            // Platform fee handling: split to vault and set pool (not to external address)
            let pool_portion = platform_fee * self.platform_pool_allocation.read().into() / 10000_u256;
            let vault_portion = platform_fee - pool_portion;
            self.platform_vault_balance.write(self.platform_vault_balance.read() + vault_portion);

            let pool_id = self.platform_pool_id.read();
            if pool_id != 0 && !pool_portion.is_zero() {
                self._deposit_platform_to_pool(pool_id, pool_portion);
            }

            let updated_payment = Payment {
                usdc_amount,
                platform_fee,  // Added
                status: PaymentStatus::Completed,
                ..payment
            };

            self.payments.write(payment_id, updated_payment);
            self.emit(PaymentCompleted {
                payment_id,
                merchant: payment.merchant,
                customer: payment.customer,
                usdc_amount,
                timestamp: get_block_timestamp(),
            });
            self.reentrancy_guard.end();
        }

        
        // Add a single pool to strategy
        fn add_pool_to_strategy(
            ref self: ContractState,
            pool_id: felt252,
            allocation_percentage: u16
        ) {
            self.reentrancy_guard.start();
            let caller = get_caller_address();
            let merchant = self.merchants.read(caller);
            assert(merchant.is_active, 'Merchant not found');
            assert(self.pool_active.read(pool_id), 'Pool not active');
            assert(allocation_percentage <= 10000, 'Allocation exceeds 100%');
            
            // Check total allocation doesn't exceed 100%
            let current_total = self._calculate_total_allocation(caller);
            assert(current_total + allocation_percentage <= 10000, 'Total exceeds 100%');
            
            self.merchant_pool_allocations.write((caller, pool_id), allocation_percentage);
            self._add_to_active_pools(caller, pool_id);
            
            self.emit(PoolActivated {
                merchant: caller,
                pool_id,
                timestamp: get_block_timestamp(),
            });
            
            self.reentrancy_guard.end();
        }
        
        
        
        // Claim yield from specific pool
        fn claim_yield_from_pool(ref self: ContractState, pool_id: felt252) {
            self.reentrancy_guard.start();
            let caller = get_caller_address();
            let mut merchant = self.merchants.read(caller);
            assert(merchant.is_active, 'Merchant not found');
            
            let shares = self.merchant_pool_shares.read((caller, pool_id));
            assert(!shares.is_zero(), 'No position');
            
            let pool_info = self.supported_pools.read(pool_id);
            let vtoken = IVesuPoolDispatcher { contract_address: pool_info.pool_address };
            let current_assets = vtoken.convert_to_assets(shares);
            let principal = self.merchant_pool_deposits.read((caller, pool_id));
            let yield_assets = current_assets - principal;
            assert(!yield_assets.is_zero(), 'No yield to claim');
            
            let shares_to_burn = vtoken.preview_redeem(yield_assets);
            let assets_received = vtoken.redeem(shares_to_burn, get_contract_address(), get_contract_address());
            
            let remaining_shares = shares - shares_to_burn;
            self.merchant_pool_shares.write((caller, pool_id), remaining_shares);
            
            // Add to vault balance
            merchant.usdc_balance += assets_received;
            self.merchants.write(caller, merchant);
            
            self.merchant_pool_yield.write((caller, pool_id), 0);
            
            self.emit(YieldClaimed {
                merchant: caller,
                amount: assets_received,
                timestamp: get_block_timestamp(),
            });
            
            self.reentrancy_guard.end();
        }

        // Deactivate a pool (admin only)
        fn deactivate_pool(ref self: ContractState, pool_id: felt252) {
            self.ownable.assert_only_owner();
            
            let mut pool_info = self.supported_pools.read(pool_id);
            assert(pool_info.pool_id != 0, 'Pool not found');
            
            pool_info.is_active = false;
            self.supported_pools.write(pool_id, pool_info);
            self.pool_active.write(pool_id, false);
            
            self.emit(PoolDeactivated {
                merchant: get_caller_address(),
                pool_id: pool_info.pool_id,
                timestamp: get_block_timestamp(),
            });
        }
        
        // Get pool information
        fn get_pool_info(self: @ContractState, pool_id: felt252) -> PoolInfo {
            self.supported_pools.read(pool_id)
        } 
        
        // Remove pool from merchant's strategy
        fn remove_pool_from_strategy(ref self: ContractState, pool_id: felt252) {
            self.reentrancy_guard.start();
            let caller = get_caller_address();
            let merchant = self.merchants.read(caller);
            assert(merchant.is_active, 'Merchant not found');
            
            // Check if merchant has any deposits in this pool
            let deposited = self.merchant_pool_deposits.read((caller, pool_id));
            assert(deposited == 0, 'Pool has active deposits');
            
            // Remove allocation
            self.merchant_pool_allocations.write((caller, pool_id), 0);
            
            // Remove from active pools list
            self._remove_from_active_pools(caller, pool_id);
            
            self.emit(PoolDeactivated {
                merchant: caller,
                pool_id,
                timestamp: get_block_timestamp(),
            });
            
            self.reentrancy_guard.end();
        }
        
        // Update allocation for a specific pool
        fn update_pool_allocation(
            ref self: ContractState,
            pool_id: felt252,
            new_allocation: u16
        ) {
            self.reentrancy_guard.start();
            let caller = get_caller_address();
            let merchant = self.merchants.read(caller);
            assert(merchant.is_active, 'Merchant not found');
            assert(self.pool_active.read(pool_id), 'Pool not active');
            assert(new_allocation <= 10000, 'Allocation exceeds 100%');
            
            // Get current allocation
            let old_allocation = self.merchant_pool_allocations.read((caller, pool_id));
            
            // Calculate total allocation excluding this pool
            let current_total = self._calculate_total_allocation(caller);
            let total_without_this = current_total - old_allocation;
            
            // Check new total doesn't exceed 100%
            assert(total_without_this + new_allocation <= 10000, 'Total exceeds 100%');
            
            // Update allocation
            self.merchant_pool_allocations.write((caller, pool_id), new_allocation);
            
            // If new allocation is 0, remove from active pools
            if new_allocation == 0 {
                self._remove_from_active_pools(caller, pool_id);
            } else if old_allocation == 0 {
                // If adding allocation to a previously inactive pool, add to active pools
                self._add_to_active_pools(caller, pool_id);
            }
            
            self.emit(MultiPoolAllocationSet {
                merchant: caller,
                pool_id,
                allocation_percentage: new_allocation,
                timestamp: get_block_timestamp(),
            });
            
            self.reentrancy_guard.end();
        }
        
        // Get merchant's allocation for a specific pool
        fn get_merchant_pool_allocation(
            self: @ContractState,
            merchant: ContractAddress,
            pool_id: felt252
        ) -> u16 {
            self.merchant_pool_allocations.read((merchant, pool_id))
        }
        
        // Compound yield from specific pool
        fn compound_pool_yield(ref self: ContractState, pool_id: felt252) {
            self.reentrancy_guard.start();
            let caller = get_caller_address();
            let merchant = self.merchants.read(caller);
            assert(merchant.is_active, 'Merchant not found');
            
            let shares = self.merchant_pool_shares.read((caller, pool_id));
            assert(!shares.is_zero(), 'No position');
            
            let pool_info = self.supported_pools.read(pool_id);
            let mut vtoken = IVesuPoolDispatcher { contract_address: pool_info.pool_address };
            let current_assets = vtoken.convert_to_assets(shares);
            let principal = self.merchant_pool_deposits.read((caller, pool_id));
            let yield_assets = current_assets - principal;
            assert(!yield_assets.is_zero(), 'No yield to compound');
            
            // Pull accrued yields by redeeming proportionally
            let shares_to_burn = vtoken.preview_redeem(yield_assets);
            let assets_received = vtoken.redeem(shares_to_burn, get_contract_address(), get_contract_address());
            
            let remaining_shares = shares - shares_to_burn;
            self.merchant_pool_shares.write((caller, pool_id), remaining_shares);
            
            // Reinvest by depositing back
            let shares_minted = vtoken.deposit(assets_received, get_contract_address());
            let updated_shares = remaining_shares + shares_minted;
            self.merchant_pool_shares.write((caller, pool_id), updated_shares);
            
            // Update principal to reflect compounded value
            let updated_principal = principal + assets_received;
            self.merchant_pool_deposits.write((caller, pool_id), updated_principal);
            
            // Reset yield counter
            self.merchant_pool_yield.write((caller, pool_id), 0);
            
            self.emit(YieldCompounded {
                merchant: caller,
                pool_id: pool_id,
                amount: assets_received,
                timestamp: get_block_timestamp(),
            });
            
            self.reentrancy_guard.end();
        }

    }
}