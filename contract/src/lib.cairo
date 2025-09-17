use starknet::ContractAddress; 

#[starknet::interface]
pub trait IEgyptFi<TContractState> {
    // Merchant management
    fn register_merchant(
        ref self: TContractState,
        withdrawal_address: ContractAddress,
        fee_percentage: u16,
    );
    fn update_merchant_withdrawal_address(
        ref self: TContractState,
        new_withdrawal_address: ContractAddress
    );
    fn deactivate_merchant(ref self: TContractState);
    
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
}

 // CustomeTypes
    #[derive(Drop, Serde, Copy, starknet::Store)]
    struct Merchant {
        is_active: bool, 
        usdc_balance: u256,
        total_payments_received: u256,
        total_payments_count: u64,
        withdrawal_address: ContractAddress,
        fee_percentage: u16, // in basis points (10000 = 100%)
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

#[starknet::contract]
mod EgyptFi {   
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

        usdc_token: ContractAddress,
        platform_fee_percentage: u16,
        platform_fee_collector: ContractAddress,
        min_payment_amount_usd: u256,

        emergency_pause: bool,

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

    #[abi(embed_v0)]
    impl EgyptFiImpl of IEgyptFi<ContractState> {

    fn register_merchant(
        ref self: ContractState, 
        withdrawal_address: ContractAddress,
        fee_percentage: u16,
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
            fee_percentage,
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
        let mut merchant = self.merchants.read(payment.merchant);

        merchant.usdc_balance += net_amount;
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

}
}