use starknet::ContractAddress;

// AutoSwappr interface
#[starknet::interface]
trait IAutoSwappr<TContractState> {
    fn ekubo_manual_swap(ref self: TContractState, swap_data: SwapData) -> SwapResult;
    fn get_token_amount_in_usd(
        self: @TContractState, token: ContractAddress, token_amount: u256
    ) -> u256;
}

#[starknet::interface]
    pub trait IEgyptFi<TContractState> {
        // Merchant management
        fn register_merchant(
            ref self: TContractState,
            name: felt252,
            email: felt252,
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
            token: ContractAddress,
            amount: u256,
            reference: felt252,
            description: felt252
        ) -> felt252;
        fn process_payment(ref self: TContractState, payment_id: felt252, swap_data: SwapData);
        
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
        fn add_supported_token(ref self: TContractState, token: ContractAddress);
        fn remove_supported_token(ref self: TContractState, token: ContractAddress);
        fn toggle_emergency_pause(ref self: TContractState);
        fn update_platform_fee(ref self: TContractState, new_fee_percentage: u16);
        fn update_min_payment_amount(ref self: TContractState, new_min_amount: u256);
        
        // Utility functions
        fn is_token_supported(self: @TContractState, token: ContractAddress) -> bool;
        fn is_paused(self: @TContractState) -> bool;
    }

    // CustomeTypes
    #[derive(Drop, Serde, Copy, starknet::Store)]
    struct Merchant {
        is_active: bool,
        name: felt252,
        email: felt252,
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
        token_paid: ContractAddress,
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

    #[derive(Clone, Drop, Serde)]
    struct SwapData {
        params: SwapParameters,
        pool_key: PoolKey,
        caller: ContractAddress,
    }

     // Swap data structures (from AutoSwappr)
    #[derive(Clone, Drop, Serde)]
    struct SwapParameters {
        amount: i129,
        is_token1: bool,
        sqrt_ratio_limit: u256,
        skip_ahead: u128,
    }

    #[derive(Clone, Drop, Serde)]
    struct PoolKey {
        token0: ContractAddress,
        token1: ContractAddress,
        fee: u128,
        tick_spacing: u128,
        extension: ContractAddress,
    }

    // Data structures
    #[derive(Clone, Drop, Serde)]
    struct i129 {
        mag: u128,
        sign: bool,
    }

    #[derive(Drop, Serde)]
    struct Delta {
        amount0: i129,
        amount1: i129,
    }

    #[derive(Drop, Serde)]
    struct SwapResult {
        delta: Delta,
    }

#[starknet::contract]
mod EgyptFi {   
    use starknet::storage::{Map, StoragePointerReadAccess, StoragePointerWriteAccess, StorageMapReadAccess, StorageMapWriteAccess};
    use super::{IAutoSwapprDispatcher, IAutoSwapprDispatcherTrait};
    use super::{Merchant, Payment, SwapData, PaymentStatus};
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
        autoswappr_contract: ContractAddress,
        platform_fee_percentage: u16,
        platform_fee_collector: ContractAddress,
        min_payment_amount_usd: u256,

        supported_tokens: Map<ContractAddress, bool>,
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
        TokenSupported: TokenSupported,
        TokenUnsupported: TokenUnsupported,
        EmergencyPauseToggled: EmergencyPauseToggled,
    }

    #[derive(Drop, starknet::Event)]
    struct MerchantRegistered {
        merchant: ContractAddress,
        name: felt252,
        email: felt252,
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
        token: ContractAddress,
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
    struct TokenSupported {
        token: ContractAddress,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct TokenUnsupported {
        token: ContractAddress,
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
        autoswappr_contract: ContractAddress,
        platform_fee_percentage: u16,
        platform_fee_collector: ContractAddress,
        min_payment_amount_usd: u256,
    ) {
        self.ownable.initializer(owner);
        self.usdc_token.write(usdc_token);
        self.autoswappr_contract.write(autoswappr_contract);
        self.platform_fee_percentage.write(platform_fee_percentage);
        self.platform_fee_collector.write(platform_fee_collector);
        self.min_payment_amount_usd.write(min_payment_amount_usd);
        self.emergency_pause.write(false);
        
        // Support USDC by default
        self.supported_tokens.write(usdc_token, true);
    }


    #[abi(embed_v0)]
    impl UpgradeableImpl of IUpgradeable<ContractState> {
        fn upgrade(ref self: ContractState, new_class_hash: ClassHash) {
            self.ownable.assert_only_owner();
            self.upgradeable.upgrade(new_class_hash);
        }
    }
 

    #[abi(embed_v0)]
    impl EgyptFiImpl of IEgyptFi<ContractState> {
        
        // ============ MERCHANT MANAGEMENT ============
        
        fn register_merchant(
            ref self: ContractState,
            name: felt252,
            email: felt252,
            withdrawal_address: ContractAddress,
            fee_percentage: u16,
        ) {
            self._assert_not_paused();
            let caller = get_caller_address();
            
            // Validate inputs
            assert(name != 0, 'Name cannot be empty');
            assert(email != 0, 'Email cannot be empty');
            assert(withdrawal_address != 0x0.try_into().unwrap(), 'Invalid withdrawal address');
            assert(fee_percentage <= 1000, 'Fee too high'); // Max 10%
            
            // Check if merchant already exists
            let existing_merchant = self.merchants.read(caller);
            assert(!existing_merchant.is_active, 'Merchant already registered');
            
            let merchant = Merchant {
                is_active: true,
                name,
                email,
                usdc_balance: 0,
                total_payments_received: 0,
                total_payments_count: 0,
                withdrawal_address,
                fee_percentage,
                joined_timestamp: get_block_timestamp(),
            };
            
            self.merchants.write(caller, merchant);
            
            self.emit(MerchantRegistered {
                merchant: caller,
                name,
                email,
                timestamp: get_block_timestamp(),
            });
        }

        fn update_merchant_withdrawal_address(
            ref self: ContractState,
            new_withdrawal_address: ContractAddress
        ) {
            self._assert_not_paused();
            let caller = get_caller_address();
            let mut merchant = self.merchants.read(caller);
            
            assert(merchant.is_active, 'Merchant not found');
            assert(new_withdrawal_address != 0x0.try_into().unwrap(), 'Invalid address');
            let updated_merchant = Merchant {
                withdrawal_address: new_withdrawal_address,
                ..merchant
            };
            self.merchants.write(caller, updated_merchant);
            
            self.emit(MerchantUpdated {
                merchant: caller,
                field: 'withdrawal_address',
                timestamp: get_block_timestamp(),
            });
        }

        fn deactivate_merchant(ref self: ContractState) {
            self._assert_not_paused();
            let caller = get_caller_address();
            let mut merchant = self.merchants.read(caller);
            
            assert(merchant.is_active, 'Merchant not found');
            
            let updated_merchant = Merchant {
                is_active: false,
                ..merchant
            };
            self.merchants.write(caller, updated_merchant);
            
            self.emit(MerchantUpdated {
                merchant: caller,
                field: 'is_active',
                timestamp: get_block_timestamp(),
            });
        }

        // ============ PAYMENT PROCESSING ============
        
        fn create_payment(
            ref self: ContractState,
            merchant: ContractAddress,
            token: ContractAddress,
            amount: u256,
            reference: felt252,
            description: felt252,
        ) -> felt252 {
            self.reentrancy_guard.start();
            self._assert_not_paused();
            
            let customer = get_caller_address();
            
            // Validate inputs
            assert(amount > 0, 'Amount must be positive');
            assert(self._is_merchant_active(merchant), 'Merchant not active');
            assert(self.supported_tokens.read(token), 'Token not supported');
            
            // Generate unique payment ID
            let payment_id = self._generate_payment_id(merchant, customer, reference);
            
            // Check if payment already exists
            let existing_payment = self.payments.read(payment_id);
            assert(existing_payment.payment_id == 0, 'Payment already exists');
            
            // Create payment record
            let payment = Payment {
                payment_id,
                merchant,
                customer,
                token_paid: token,
                amount_paid: amount,
                usdc_amount: 0, // Will be set after swap
                status: PaymentStatus::Pending,
                timestamp: get_block_timestamp(),
                reference,
                description,
            };
            
            self.payments.write(payment_id, payment);
            
            // Add to merchant's payment list
            let payment_count = self.merchant_payment_count.read(merchant);
            self.merchant_payments.write((merchant, payment_count), payment_id);
            self.merchant_payment_count.write(merchant, payment_count + 1);
            
            self.emit(PaymentCreated {
                payment_id,
                merchant,
                customer,
                token,
                amount,
                reference,
            });
            
            self.reentrancy_guard.end();
            payment_id
        }

        fn process_payment(ref self: ContractState, payment_id: felt252, swap_data: SwapData) {
            self.reentrancy_guard.start();
            self._assert_not_paused();
            
            let caller = get_caller_address();
            let mut payment = self.payments.read(payment_id);
            
            // Validate payment
            assert(payment.payment_id != 0, 'Payment not found');
            assert(payment.customer == caller, 'Not payment owner');
            assert(payment.status == PaymentStatus::Pending, 'Payment not pending');
            
            // Transfer tokens from customer to contract
            let token_contract = IERC20Dispatcher { contract_address: payment.token_paid };
            let contract_address = get_contract_address();
            
            let success = token_contract.transfer_from(
                caller, 
                contract_address, 
                payment.amount_paid
            );
            assert(success, 'Token transfer failed');
            
            let mut usdc_amount = payment.amount_paid;
            
            // Swap to USDC if not already USDC
            if payment.token_paid != self.usdc_token.read() {
                usdc_amount = self._swap_to_usdc(payment.token_paid, payment.amount_paid, swap_data);
            }
            
            // Validate minimum payment amount
            assert(usdc_amount >= self.min_payment_amount_usd.read(), 'Payment below minimum');
            
            // Calculate fees
            let merchant_info = self.merchants.read(payment.merchant);
            let platform_fee = (usdc_amount * self.platform_fee_percentage.read().into()) / 10000;
            let merchant_fee = (usdc_amount * merchant_info.fee_percentage.into()) / 10000;
            let total_fees = platform_fee + merchant_fee;
            let net_amount = usdc_amount - total_fees;
            
            // Update merchant balance
            let updated_merchant = Merchant {
                usdc_balance: merchant_info.usdc_balance + net_amount,
                total_payments_received: merchant_info.total_payments_received + usdc_amount,
                total_payments_count: merchant_info.total_payments_count + 1,
                ..merchant_info
            };
            self.merchants.write(payment.merchant, updated_merchant);
            
            // Transfer platform fee
            if platform_fee > 0 {
                let usdc_contract = IERC20Dispatcher { contract_address: self.usdc_token.read() };
                usdc_contract.transfer(self.platform_fee_collector.read(), platform_fee);
            }
            
            // Update payment status
            let updated_payment = Payment {
                usdc_amount: usdc_amount,
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

        // ============ WITHDRAWAL & REFUNDS ============
        
        fn withdraw_funds(ref self: ContractState, amount: u256) {
            self.reentrancy_guard.start();
            self._assert_not_paused();
            
            let caller = get_caller_address();
            let mut merchant = self.merchants.read(caller);
            
            assert(merchant.is_active, 'Merchant not found');
            assert(amount > 0, 'Amount must be positive');
            assert(amount <= merchant.usdc_balance, 'Insufficient balance');
            
            // Update merchant balance
            let updated_merchant = Merchant {
                usdc_balance: merchant.usdc_balance - amount,
                ..merchant
            };
            self.merchants.write(caller, updated_merchant);
            
            // Transfer USDC
            let usdc_contract = IERC20Dispatcher { contract_address: self.usdc_token.read() };
            let success = usdc_contract.transfer(merchant.withdrawal_address, amount);
            assert(success, 'Transfer failed');
            
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
            
            // Update merchant balance
            let updated_merchant = Merchant {
                usdc_balance: merchant.usdc_balance - payment.usdc_amount,
                ..merchant
            };
            self.merchants.write(caller, updated_merchant);
            
            // Refund to customer (in USDC)
            let usdc_contract = IERC20Dispatcher { contract_address: self.usdc_token.read() };
            let success = usdc_contract.transfer(payment.customer, payment.usdc_amount);
            assert(success, 'Refund transfer failed');
            
            // Update payment status
            let updated_payment = Payment {
                status: PaymentStatus::Refunded,
                ..payment
            };
            self.payments.write(payment_id, updated_payment);
            
            self.emit(PaymentRefunded {
                payment_id,
                merchant: payment.merchant,
                customer: payment.customer,
                refund_amount: payment.usdc_amount,
                timestamp: get_block_timestamp(),
            });
            
            self.reentrancy_guard.end();
        }

        // ============ VIEW FUNCTIONS ============
        
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
            
            let mut i = offset;
            let end = if offset + limit > total_payments { 
                total_payments 
            } else { 
                offset + limit 
            };
            
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

        // ============ ADMIN FUNCTIONS ============
        
        fn add_supported_token(ref self: ContractState, token: ContractAddress) {
            self.ownable.assert_only_owner();
            self.supported_tokens.write(token, true);
            
            self.emit(TokenSupported {
                token,
                timestamp: get_block_timestamp(),
            });
        }

        fn remove_supported_token(ref self: ContractState, token: ContractAddress) {
            self.ownable.assert_only_owner();
            assert(token != self.usdc_token.read(), 'Cannot remove USDC');
            self.supported_tokens.write(token, false);
            
            self.emit(TokenUnsupported {
                token,
                timestamp: get_block_timestamp(),
            });
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

        // ============ UTILITY FUNCTIONS ============
        
        fn is_token_supported(self: @ContractState, token: ContractAddress) -> bool {
            self.supported_tokens.read(token)
        }

        fn is_paused(self: @ContractState) -> bool {
            self.emergency_pause.read()
        }
    }

    // ============ INTERNAL FUNCTIONS ============
    
    #[generate_trait]
    impl InternalFunctions of InternalFunctionsTrait {
        fn _assert_not_paused(self: @ContractState) {
            assert(!self.emergency_pause.read(), 'Contract is paused');
        }

        fn _is_merchant_active(self: @ContractState, merchant: ContractAddress) -> bool {
            let merchant_info = self.merchants.read(merchant);
            merchant_info.is_active
        }

        fn _generate_payment_id(
            self: @ContractState,
            merchant: ContractAddress,
            customer: ContractAddress,
            reference: felt252
        ) -> felt252 { 

            let mut state = PoseidonTrait::new();
            
            let timestamp = get_block_timestamp();
            let mut data = ArrayTrait::new();
            data.append(merchant.into());
            data.append(customer.into());
            data.append(reference);
            data.append(timestamp.into());
            
            let payment_id = state.finalize(); 

            payment_id          
            
        }

fn _swap_to_usdc(
    ref self: ContractState,
    token_in: ContractAddress,
    amount_in: u256,
    swap_data: SwapData,
) -> u256 {
    let autoswappr = IAutoSwapprDispatcher {
        contract_address: self.autoswappr_contract.read(),
    };

    // Approve AutoSwappr to spend tokens
    let token_contract = IERC20Dispatcher { contract_address: token_in };
    token_contract.approve(self.autoswappr_contract.read(), amount_in);

    // Execute swap
    let swap_data_clone = swap_data.clone();
    let swap_result = autoswappr.ekubo_manual_swap(swap_data_clone);

    // Calculate USDC received from swap result
    let delta = swap_result.delta;
    let usdc_received = if swap_data.pool_key.token0 == self.usdc_token.read() {
        // If USDC is token0, use amount0
        match delta.amount0.sign {
            false => delta.amount0.mag.into(), // Positive amount
            true => {
                assert!(false, "Unexpected negative amount for token0");
                0
                        },
                    }
                } else if swap_data.pool_key.token1 == self.usdc_token.read() {
                    // If USDC is token1, use amount1
                    match delta.amount1.sign {
                        false => delta.amount1.mag.into(), // Positive amount
                        true => {
                            assert!(false, "Unexpected negative amount for token1");
                            0
                        },
                    }
                } else {
                    // Neither token0 nor token1 is USDC
                    assert!(false, "USDC not found in pool");
                    0
                };

                usdc_received
            }
    }

}
