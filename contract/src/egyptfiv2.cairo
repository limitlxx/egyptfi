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
}

 // CustomeTypes
    #[derive(Drop, Serde, Copy, starknet::Store)]
    struct Merchant {
        is_active: bool, 
        usdc_balance: u256,
        total_payments_received: u256,
        total_payments_count: u64,
        withdrawal_address: ContractAddress,
        metadata_hash: felt252, // in basis points (10000 = 100%)
        joined_timestamp: u64,
    }

    #[derive(Drop, Serde, Copy, starknet::Store)]
    struct Payment {
        payment_id: felt252,
        merchant: ContractAddress,
        customer: ContractAddress,
        amount_paid: u256,
        usdc_amount: u256,
        status: PaymentStatus,
        timestamp: u64,
        reference: felt252,
        description: felt252,
    }


    #[derive(Copy, Drop, Serde, PartialEq, starknet::Store)]
    #[allow(starknet::store_no_default_variant)]
    enum PaymentStatus {
        Pending,
        Completed,
        Refunded,
        Failed,
    }

    #[derive(Drop, Serde, Copy, starknet::Store)]
    struct PoolInfo {
        pool_id: felt252,
        pool_address: ContractAddress,
        pool_name: felt252, // e.g., 'Re7', 'Troves'
        pool_type: felt252, // e.g., 'Stablecoin', 'ETH'
        is_active: bool,
    }

#[starknet::contract]
mod EgyptFi {   
    use crate::PoolInfo; 
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
        merchant_pool_deposits: Map<(ContractAddress, felt252), u256>, // (merchant, pool_id) -> deposited amount
        merchant_pool_yield: Map<(ContractAddress, felt252), u256>, // (merchant, pool_id) -> unclaimed yield
        
        // Pool registry
        supported_pools: Map<felt252, PoolInfo>, // pool_id -> pool info
        pool_count: u64,
        pool_active: Map<felt252, bool>, // pool_id -> is_active
        pool_ids: Map<u64, felt252>, // index -> pool_id      

        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
         #[substorage(v0)]
        reentrancy_guard: ReentrancyGuardComponent::Storage,
        #[substorage(v0)]
        upgradeable: UpgradeableComponent::Storage
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
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
    struct YieldDeposited {
            merchant: ContractAddress,
            amount: u256,
            pool_id: felt252,
            timestamp: u64,
        }

        #[derive(Drop, starknet::Event)]
    struct YieldClaimed {
            merchant: ContractAddress,
            amount: u256,
            timestamp: u64,
        }

        #[derive(Drop, starknet::Event)]
        struct YieldCompounded {
            merchant: ContractAddress,
            pool_id: felt252,
            amount: u256,
            timestamp: u64,
        }
 

    #[derive(Drop, starknet::Event)]
    struct MerchantRegistered {
        merchant: ContractAddress, 
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct MerchantUpdated {
        merchant: ContractAddress,
        field: felt252,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct PaymentCreated {
        payment_id: felt252,
        merchant: ContractAddress,
        customer: ContractAddress,
        amount: u256,
        reference: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct PaymentCompleted {
        payment_id: felt252,
        merchant: ContractAddress,
        customer: ContractAddress,
        usdc_amount: u256,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct PaymentRefunded {
        payment_id: felt252,
        merchant: ContractAddress,
        customer: ContractAddress,
        refund_amount: u256,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct WithdrawalMade {
        merchant: ContractAddress,
        amount: u256,
        to_address: ContractAddress,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct EmergencyPauseToggled {
        paused: bool,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct PoolRegistered {
        pool_id: felt252,
        pool_address: ContractAddress,
        pool_name: felt252,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct MultiPoolAllocationSet {
        merchant: ContractAddress,
        pool_id: felt252,
        allocation_percentage: u16,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct PoolActivated {
        merchant: ContractAddress,
        pool_id: felt252,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct PoolDeactivated {
        merchant: ContractAddress,
        pool_id: felt252,
        timestamp: u64,
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
        let current_deposits = self.merchant_pool_deposits.read((merchant, pool_id));
        self.merchant_pool_deposits.write((merchant, pool_id), current_deposits + amount);
        
        // TODO: Actual Vesu pool interaction
        // Example:
        // let pool_info = self.supported_pools.read(pool_id);
        // let vesu_pool = IVesuPoolDispatcher { contract_address: pool_info.pool_address };
        // vesu_pool.deposit(amount);
        
        self.emit(YieldDeposited {
            merchant,
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

        let mut merchant = self.merchants.read(caller);
        assert(merchant.usdc_balance >= payment.usdc_amount, 'Insufficient merchant balance');

        merchant.usdc_balance -= payment.usdc_amount;
        self.merchants.write(caller, merchant);

        let usdc_contract = IERC20Dispatcher { contract_address: self.usdc_token.read() };
        usdc_contract.transfer(payment.customer, payment.usdc_amount);
        
        payment.status = PaymentStatus::Refunded;
        self.payments.write(payment_id, payment);
        self.emit(PaymentRefunded {
            payment_id,
            merchant: payment.merchant,
            customer: payment.customer,
            refund_amount: payment.usdc_amount,
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
    }

    fn update_min_payment_amount(ref self: ContractState, new_min_amount: u256) {
        self.ownable.assert_only_owner();
        self.min_payment_amount_usd.write(new_min_amount);
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
            let yield_amount = self.merchant_pool_yield.read((caller, pool_id));
            
            if yield_amount > 0 {
                // Add to vault balance
                total_claimed += yield_amount;
                
                // Reset yield counter
                self.merchant_pool_yield.write((caller, pool_id), 0);
                
                self.emit(YieldClaimed {
                    merchant: caller,
                    amount: yield_amount,
                    timestamp: get_block_timestamp(),
                });
            }
            
            i += 1;
        };
        
        assert(total_claimed > 0, 'No yield to claim');
        
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
            let yield_amount = self.merchant_pool_yield.read((caller, pool_id));
            
            if yield_amount > 0 {
                // Add yield back to pool deposits
                let current_deposits = self.merchant_pool_deposits.read((caller, pool_id));
                self.merchant_pool_deposits.write((caller, pool_id), current_deposits + yield_amount);
                
                // Reset yield counter
                self.merchant_pool_yield.write((caller, pool_id), 0);
                
                total_compounded += yield_amount;
                
                self.emit(YieldCompounded {
                    merchant: caller,
                    pool_id: pool_id,
                    amount: yield_amount,
                    timestamp: get_block_timestamp(),
                });
            }
            
            i += 1;
        };
        
        assert(total_compounded > 0, 'No yield to compound');
        
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
        usdc_contract.transfer(self.platform_fee_collector.read(), platform_fee);

        let updated_payment = Payment {
            usdc_amount,
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
        
        let yield_amount = self.merchant_pool_yield.read((caller, pool_id));
        assert(yield_amount > 0, 'No yield to claim');
        
        // Add to vault balance
        merchant.usdc_balance += yield_amount;
        self.merchants.write(caller, merchant);
        
        // Reset yield counter
        self.merchant_pool_yield.write((caller, pool_id), 0);
        
        self.emit(YieldClaimed {
            merchant: caller,
            amount: yield_amount,
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
        
        self.emit(MerchantUpdated {
            merchant: get_caller_address(),
            field: 'pool_deactivated',
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
        
        let yield_amount = self.merchant_pool_yield.read((caller, pool_id));
        assert(yield_amount > 0, 'No yield to compound');
        
        // Add yield back to pool deposits
        let current_deposits = self.merchant_pool_deposits.read((caller, pool_id));
        self.merchant_pool_deposits.write((caller, pool_id), current_deposits + yield_amount);
        
        // Reset yield counter
        self.merchant_pool_yield.write((caller, pool_id), 0);
        
        // TODO: Actual Vesu pool interaction for compound
        
        self.emit(YieldCompounded {
            merchant: caller,
            pool_id: pool_id,
            amount: yield_amount,
            timestamp: get_block_timestamp(),
        });
        
        self.reentrancy_guard.end();
    }

}
}

