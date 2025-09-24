#[cfg(test)]
mod tests {
    use safebox::EgyptFi;
    use safebox::{IEgyptFiDispatcher, IEgyptFiDispatcherTrait};
    use safebox::PaymentStatus;
    use snforge_std::{
        ContractClassTrait, DeclareResultTrait, declare, spy_events, EventSpyAssertionsTrait,
        start_cheat_caller_address, stop_cheat_caller_address
    };
    use starknet::{ContractAddress, contract_address_const};

    // Mock ERC20 for testing
    #[starknet::interface]
    trait IMockERC20<TContractState> {
        fn total_supply(self: @TContractState) -> u256;
        fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
        fn allowance(self: @TContractState, owner: ContractAddress, spender: ContractAddress) -> u256;
        fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
        fn transfer_from(ref self: TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256) -> bool;
        fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;

        fn name(self: @TContractState) -> ByteArray;
        fn symbol(self: @TContractState) -> ByteArray;
        fn decimals(self: @TContractState) -> u8;

        fn mint(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    }

    #[starknet::contract]
    mod MockERC20 {
        use starknet::event::EventEmitter;
        use starknet::{ContractAddress, get_caller_address};
        use core::starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess, Map, StoragePathEntry};
        use core::num::traits::Zero;

        #[storage]
        pub struct Storage {
            balances: Map<ContractAddress, u256>,
            allowances: Map<(ContractAddress, ContractAddress), u256>, // Mapping<(owner, spender), amount>
            token_name: ByteArray,
            symbol: ByteArray,
            decimal: u8,
            total_supply: u256,
            owner: ContractAddress,
        }

        #[event]
        #[derive(Drop, starknet::Event)]
        pub enum Event {
            Transfer: Transfer,
            Approval: Approval,
        }

        #[derive(Drop, starknet::Event)]
        pub struct Transfer {
            #[key]
            from: ContractAddress,
            #[key]
            to: ContractAddress,
            amount: u256,
        }

        #[derive(Drop, starknet::Event)]
        pub struct Approval {
            #[key]
            owner: ContractAddress,
            #[key]
            spender: ContractAddress,
            value: u256
        }

        #[constructor]
        fn constructor(ref self: ContractState) {
            self.token_name.write("USDC");
            self.symbol.write("USDC");
            self.decimal.write(6);
            self.owner.write(get_caller_address());
        }

        #[abi(embed_v0)]
        impl MockERC20Impl of super::IMockERC20<ContractState> {
            fn total_supply(self: @ContractState) -> u256 {
                self.total_supply.read()
            }

            fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
                let balance = self.balances.entry(account).read();

                balance
            }

            fn allowance(self: @ContractState, owner: ContractAddress, spender: ContractAddress) -> u256 {
                let allowance = self.allowances.entry((owner, spender)).read();

                allowance
            }

            fn transfer(ref self: ContractState, recipient: ContractAddress, amount: u256) -> bool {
                let sender = get_caller_address();

                let sender_prev_balance = self.balances.entry(sender).read();
                let recipient_prev_balance = self.balances.entry(recipient).read();

                assert(sender_prev_balance >= amount, 'Insufficient amount');

                self.balances.entry(sender).write(sender_prev_balance - amount);
                self.balances.entry(recipient).write(recipient_prev_balance + amount);

                assert(self.balances.entry(recipient).read() > recipient_prev_balance, 'Transaction failed');

                self.emit(Transfer { from: sender, to: recipient, amount });

                true
            }

            fn transfer_from(ref self: ContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256) -> bool {
                let spender = get_caller_address();

                let spender_allowance = self.allowances.entry((sender, spender)).read();
                let sender_balance = self.balances.entry(sender).read();
                let recipient_balance = self.balances.entry(recipient).read();

                assert(amount >= spender_allowance, 'amount exceeds allowance');
                assert(amount >= sender_balance, 'amount exceeds balance');

                self.allowances.entry((sender, spender)).write(spender_allowance - amount);
                self.balances.entry(sender).write(sender_balance - amount);
                self.balances.entry(recipient).write(recipient_balance + amount);

                self.emit(Transfer { from: sender, to: recipient, amount });

                true
            }

            fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
                let caller = get_caller_address();

                self.allowances.entry((caller, spender)).write(amount);

                self.emit(Approval { owner: caller, spender, value: amount });

                true
            }

            fn name(self: @ContractState) -> ByteArray {
                self.token_name.read()
            }

            fn symbol(self: @ContractState) -> ByteArray {
                self.symbol.read()
            }

            fn decimals(self: @ContractState) -> u8 {
                self.decimal.read()
            }

            fn mint(ref self: ContractState, recipient: ContractAddress, amount: u256) -> bool {
                let previous_total_supply = self.total_supply.read();
                let previous_balance = self.balances.entry(recipient).read();

                self.total_supply.write(previous_total_supply + amount);
                self.balances.entry(recipient).write(previous_balance + amount);

                let zero_address = Zero::zero();

                self.emit(Transfer { from: zero_address, to: recipient, amount });

                true
            }
        }
    }
    

    fn deploy_mock_erc20( ) -> (IMockERC20Dispatcher, ContractAddress) {
        let contract = declare("MockERC20").unwrap().contract_class();
        let (contract_address, _) = contract.deploy(@ArrayTrait::new()).unwrap();
        let dispatcher = IMockERC20Dispatcher { contract_address };
        (dispatcher, contract_address)
    }

    fn deploy_egyptfi(
        owner: ContractAddress,
        usdc: ContractAddress,
        fee: u16,
        collector: ContractAddress,
        min_amount: u256
    ) -> IEgyptFiDispatcher {
        let contract = declare("EgyptFi").unwrap().contract_class();
        let mut calldata = array![];
        owner.serialize(ref calldata);
        usdc.serialize(ref calldata);
        fee.serialize(ref calldata);
        collector.serialize(ref calldata);
        min_amount.serialize(ref calldata);

        let (address, _) = contract.deploy(@calldata).unwrap();
        IEgyptFiDispatcher { contract_address: address }
    }

    fn setup() -> (IEgyptFiDispatcher, ContractAddress, IMockERC20Dispatcher, ContractAddress, ContractAddress) {
        let owner = contract_address_const::<'owner'>();
        let merchant = contract_address_const::<'merchant'>();
        let customer = contract_address_const::<'customer'>();
        let collector = contract_address_const::<'collector'>();

        let (usdc_dispatcher, usdc_address) = deploy_mock_erc20( ); 

        let fee = 100; // 1%
        let min_amount = 1000000; // 1 USDC

        let egyptfi = deploy_egyptfi(owner, usdc_address, fee, collector, min_amount);

        (egyptfi, owner, usdc_dispatcher, merchant, customer)
    }

    #[test]
    fn test_constructor() {
        let (egyptfi, _, _, _, _) = setup();

        assert_eq!(egyptfi.is_paused(), false);
        // Test other initial states if possible, but since storage is private, we rely on behavior
    }

    #[test]
    fn test_register_merchant() {
        let (egyptfi, _, _, merchant, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();
        let metadata_hash = 123;

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        let mut spy = spy_events();

        egyptfi.register_merchant(withdrawal_address, metadata_hash);

        let merchant_data = egyptfi.get_merchant(merchant);
        assert_eq!(merchant_data.is_active, true);
        assert_eq!(merchant_data.withdrawal_address, withdrawal_address);
        assert_eq!(merchant_data.metadata_hash, metadata_hash);
        assert_eq!(merchant_data.usdc_balance, 0);
        assert_eq!(merchant_data.total_payments_received, 0);
        assert_eq!(merchant_data.total_payments_count, 0);

        let expected_event = EgyptFi::Event::MerchantRegistered(
            EgyptFi::MerchantRegistered { merchant, timestamp: starknet::get_block_timestamp() }
        );
        spy.assert_emitted(@array![(egyptfi.contract_address, expected_event)]);

        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Merchant already registered')]
    fn test_register_merchant_already_registered() {
        let (egyptfi, _, _, merchant, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();
        let metadata_hash = 123;

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, metadata_hash);
        egyptfi.register_merchant(withdrawal_address, metadata_hash);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    fn test_update_merchant_withdrawal_address() {
        let (egyptfi, _, _, merchant, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();
        let new_withdrawal = contract_address_const::<'new_withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);

        let mut spy = spy_events();
        egyptfi.update_merchant_withdrawal_address(new_withdrawal);

        let merchant_data = egyptfi.get_merchant(merchant);
        assert_eq!(merchant_data.withdrawal_address, new_withdrawal);

        let expected_event = EgyptFi::Event::MerchantUpdated(
            EgyptFi::MerchantUpdated { merchant, field: 'withdrawal_address', timestamp: starknet::get_block_timestamp() }
        );
        spy.assert_emitted(@array![(egyptfi.contract_address, expected_event)]);

        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Merchant not found')]
    fn test_update_merchant_withdrawal_address_not_registered() {
        let (egyptfi, _, _, merchant, _) = setup();
        let new_withdrawal = contract_address_const::<'new_withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.update_merchant_withdrawal_address(new_withdrawal);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    fn test_update_merchant_metadata() {
        let (egyptfi, _, _, merchant, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);

        let mut spy = spy_events();
        egyptfi.update_merchant_metadata(456);

        let merchant_data = egyptfi.get_merchant(merchant);
        assert_eq!(merchant_data.metadata_hash, 456);

        let expected_event = EgyptFi::Event::MerchantUpdated(
            EgyptFi::MerchantUpdated { merchant, field: 'metadata_hash', timestamp: starknet::get_block_timestamp() }
        );
        spy.assert_emitted(@array![(egyptfi.contract_address, expected_event)]);

        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    fn test_deactivate_merchant() {
        let (egyptfi, _, _, merchant, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);

        let mut spy = spy_events();
        egyptfi.deactivate_merchant();

        let merchant_data = egyptfi.get_merchant(merchant);
        assert_eq!(merchant_data.is_active, false);

        let expected_event = EgyptFi::Event::MerchantUpdated(
            EgyptFi::MerchantUpdated { merchant, field: 'deactivated', timestamp: starknet::get_block_timestamp() }
        );
        spy.assert_emitted(@array![(egyptfi.contract_address, expected_event)]);

        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    fn test_create_payment() {
        let (egyptfi, _, _, merchant, customer) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);
        let amount = 2000000; // 2 USDC
        let reference = 999;
        let description = 888;

        let mut spy = spy_events();
        let payment_id = egyptfi.create_payment(merchant, amount, reference, description);

        let payment = egyptfi.get_payment(payment_id);
        assert_eq!(payment.payment_id, payment_id);
        assert_eq!(payment.merchant, merchant);
        assert_eq!(payment.customer, customer);
        assert_eq!(payment.amount_paid, amount);
        assert_eq!(payment.usdc_amount, 0);
        assert_eq!(payment.status, safebox::PaymentStatus::Pending);
        assert_eq!(payment.reference, reference);
        assert_eq!(payment.description, description);

        let expected_event = EgyptFi::Event::PaymentCreated(
            EgyptFi::PaymentCreated { payment_id, merchant, customer, amount, reference }
        );
        spy.assert_emitted(@array![(egyptfi.contract_address, expected_event)]);

        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Merchant not active')]
    fn test_create_payment_merchant_not_active() {
        let (egyptfi, _, _, merchant, customer) = setup();

        start_cheat_caller_address(egyptfi.contract_address, customer);
        egyptfi.create_payment(merchant, 2000000, 999, 888);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Amount must be positive')]
    fn test_create_payment_zero_amount() {
        let (egyptfi, _, _, merchant, customer) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);
        egyptfi.create_payment(merchant, 0, 999, 888);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Amount below minimum')]
    fn test_create_payment_below_minimum() {
        let (egyptfi, _, _, merchant, customer) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);
        egyptfi.create_payment(merchant, 500000, 999, 888); // 0.5 USDC
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    fn test_process_payment() {
        let (egyptfi, _, usdc, merchant, customer) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);
        let amount = 2000000; // 2 USDC
        let payment_id = egyptfi.create_payment(merchant, amount, 999, 888);

        // Approve transfer
        start_cheat_caller_address(usdc.contract_address, customer);
        usdc.approve(egyptfi.contract_address, amount);
        stop_cheat_caller_address(usdc.contract_address);

        let mut spy = spy_events();
        egyptfi.process_payment(payment_id);

        let payment = egyptfi.get_payment(payment_id);
        assert_eq!(payment.status, safebox::PaymentStatus::Completed);
        assert_eq!(payment.usdc_amount, amount);

        let merchant_data = egyptfi.get_merchant(merchant);
        let expected_net = amount - (amount * 100 / 10000); // 1% fee
        assert_eq!(merchant_data.usdc_balance, expected_net);
        assert_eq!(merchant_data.total_payments_received, expected_net);
        assert_eq!(merchant_data.total_payments_count, 1);

        let expected_event = EgyptFi::Event::PaymentCompleted(
            EgyptFi::PaymentCompleted {
                payment_id,
                merchant,
                customer,
                usdc_amount: amount,
                timestamp: starknet::get_block_timestamp()
            }
        );
        spy.assert_emitted(@array![(egyptfi.contract_address, expected_event)]);

        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[ignore]
    #[should_panic(expected: 'Payment not found')]
    fn test_process_payment_not_found() {
        let (egyptfi, _, _, _, customer) = setup();

        start_cheat_caller_address(egyptfi.contract_address, customer);
        egyptfi.process_payment('0'); // Non-existent payment ID
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Payment not pending')]
    fn test_process_payment_not_pending() {
        let (egyptfi, _, usdc, merchant, customer) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);
        let amount = 2000000;
        let payment_id = egyptfi.create_payment(merchant, amount, 999, 888);

        start_cheat_caller_address(usdc.contract_address, customer);
        usdc.approve(egyptfi.contract_address, amount);
        stop_cheat_caller_address(usdc.contract_address);

        egyptfi.process_payment(payment_id);
        egyptfi.process_payment(payment_id); // Try again
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Not payment customer')]
    fn test_process_payment_wrong_customer() {
        let (egyptfi, _, _, merchant, customer) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);
        let amount = 2000000;
        let payment_id = egyptfi.create_payment(merchant, amount, 999, 888);
        stop_cheat_caller_address(egyptfi.contract_address);

        let wrong_customer = contract_address_const::<'wrong_customer'>();
        start_cheat_caller_address(egyptfi.contract_address, wrong_customer);
        egyptfi.process_payment(payment_id);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    fn test_withdraw_funds() {
        let (egyptfi, _, usdc, merchant, customer) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        // Register merchant and process payment
        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);
        let amount = 2000000;
        let payment_id = egyptfi.create_payment(merchant, amount, 999, 888);

        start_cheat_caller_address(usdc.contract_address, customer);
        usdc.approve(egyptfi.contract_address, amount);
        stop_cheat_caller_address(usdc.contract_address);

        egyptfi.process_payment(payment_id);
        stop_cheat_caller_address(egyptfi.contract_address);

        // Withdraw
        start_cheat_caller_address(egyptfi.contract_address, merchant);
        let withdraw_amount = 1000000000000000000; // 1 USDC
        let mut spy = spy_events();
        egyptfi.withdraw_funds(withdraw_amount);

        let merchant_data = egyptfi.get_merchant(merchant);
        assert_eq!(merchant_data.usdc_balance, 990000000000000000); // 0.99 USDC

        let expected_event = EgyptFi::Event::WithdrawalMade(
            EgyptFi::WithdrawalMade {
                merchant,
                amount: withdraw_amount,
                to_address: withdrawal_address,
                timestamp: starknet::get_block_timestamp()
            }
        );
        spy.assert_emitted(@array![(egyptfi.contract_address, expected_event)]);

        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Insufficient balance')]
    fn test_withdraw_funds_insufficient_balance() {
        let (egyptfi, _, _, merchant, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        egyptfi.withdraw_funds(1000000000000000000);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    fn test_refund_payment() {
        let (egyptfi, _, usdc, merchant, customer) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        // Register merchant and process payment
        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);
        let amount = 2000000;
        let payment_id = egyptfi.create_payment(merchant, amount, 999, 888);

        start_cheat_caller_address(usdc.contract_address, customer);
        usdc.approve(egyptfi.contract_address, amount);
        stop_cheat_caller_address(usdc.contract_address);

        egyptfi.process_payment(payment_id);
        stop_cheat_caller_address(egyptfi.contract_address);

        // Refund
        start_cheat_caller_address(egyptfi.contract_address, merchant);
        let mut spy = spy_events();
        egyptfi.refund_payment(payment_id);

        let payment = egyptfi.get_payment(payment_id);
        assert_eq!(payment.status, safebox::PaymentStatus::Refunded);

        let merchant_data = egyptfi.get_merchant(merchant);
        assert_eq!(merchant_data.usdc_balance, 0);

        let expected_event = EgyptFi::Event::PaymentRefunded(
            EgyptFi::PaymentRefunded {
                payment_id,
                merchant,
                customer,
                refund_amount: amount,
                timestamp: starknet::get_block_timestamp()
            }
        );
        spy.assert_emitted(@array![(egyptfi.contract_address, expected_event)]);

        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Payment not completed')]
    fn test_refund_payment_not_completed() {
        let (egyptfi, _, _, merchant, customer) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);
        let amount = 2000000;
        let payment_id = egyptfi.create_payment(merchant, amount, 999, 888);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.refund_payment(payment_id);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    fn test_get_merchant_payments() {
        let (egyptfi, _, _, merchant, customer) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);
        let payment_id1 = egyptfi.create_payment(merchant, 2000000, 999, 888);
        let payment_id2 = egyptfi.create_payment(merchant, 2000000, 998, 887);
        stop_cheat_caller_address(egyptfi.contract_address);

        let payments = egyptfi.get_merchant_payments(merchant, 0, 10);
        assert_eq!(payments.len(), 2);
        assert_eq!(*payments.at(0), payment_id1);
        assert_eq!(*payments.at(1), payment_id2);
    }

    #[test]
    fn test_verify_payment() {
        let (egyptfi, _, usdc, merchant, customer) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);
        let amount = 2000000;
        let payment_id = egyptfi.create_payment(merchant, amount, 999, 888);

        start_cheat_caller_address(usdc.contract_address, customer);
        usdc.approve(egyptfi.contract_address, amount);
        stop_cheat_caller_address(usdc.contract_address);

        egyptfi.process_payment(payment_id);
        stop_cheat_caller_address(egyptfi.contract_address);

        assert_eq!(egyptfi.verify_payment(payment_id, merchant), true);
        assert_eq!(egyptfi.verify_payment(payment_id, contract_address_const::<'wrong_merchant'>()), false);
    }

    #[test]
    fn test_toggle_emergency_pause() {
        let (egyptfi, owner, _, _, _) = setup();

        start_cheat_caller_address(egyptfi.contract_address, owner);
        let mut spy = spy_events();
        egyptfi.toggle_emergency_pause();

        assert_eq!(egyptfi.is_paused(), true);

        let expected_event = EgyptFi::Event::EmergencyPauseToggled(
            EgyptFi::EmergencyPauseToggled { paused: true, timestamp: starknet::get_block_timestamp() }
        );
        spy.assert_emitted(@array![(egyptfi.contract_address, expected_event)]);

        spy = spy_events();
        egyptfi.toggle_emergency_pause();
        assert_eq!(egyptfi.is_paused(), false);

        let expected_event2 = EgyptFi::Event::EmergencyPauseToggled(
            EgyptFi::EmergencyPauseToggled { paused: false, timestamp: starknet::get_block_timestamp() }
        );
        spy.assert_emitted(@array![(egyptfi.contract_address, expected_event2)]);

        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Caller is not the owner')]
    fn test_toggle_emergency_pause_not_owner() {
        let (egyptfi, _, _, _, customer) = setup();

        start_cheat_caller_address(egyptfi.contract_address, customer);
        egyptfi.toggle_emergency_pause();
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    fn test_update_platform_fee() {
        let (egyptfi, owner, _, _, _) = setup();

        start_cheat_caller_address(egyptfi.contract_address, owner);
        egyptfi.update_platform_fee(200); // 2%
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Fee too high')]
    fn test_update_platform_fee_too_high() {
        let (egyptfi, owner, _, _, _) = setup();

        start_cheat_caller_address(egyptfi.contract_address, owner);
        egyptfi.update_platform_fee(600); // 6%
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    fn test_update_min_payment_amount() {
        let (egyptfi, owner, _, _, _) = setup();

        start_cheat_caller_address(egyptfi.contract_address, owner);
        egyptfi.update_min_payment_amount(2000000);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Contract is paused')]
    fn test_create_payment_when_paused() {
        let (egyptfi, owner, _, merchant, customer) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, owner);
        egyptfi.toggle_emergency_pause();
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);
        egyptfi.create_payment(merchant, 2000000, 999, 888);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Contract is paused')]
    fn test_process_payment_when_paused() {
        let (egyptfi, owner, _, merchant, customer) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);
        let payment_id = egyptfi.create_payment(merchant, 2000000, 999, 888);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, owner);
        egyptfi.toggle_emergency_pause();
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);
        egyptfi.process_payment(payment_id);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Contract is paused')]
    fn test_withdraw_funds_when_paused() {
        let (egyptfi, owner, _, merchant, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, owner);
        egyptfi.toggle_emergency_pause();
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.withdraw_funds(1000000000000000000);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Contract is paused')]
    fn test_refund_payment_when_paused() {
        let (egyptfi, owner, usdc, merchant, customer) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);
        let amount = 2000000;
        let payment_id = egyptfi.create_payment(merchant, amount, 999, 888);

        start_cheat_caller_address(usdc.contract_address, customer);
        usdc.approve(egyptfi.contract_address, amount);
        stop_cheat_caller_address(usdc.contract_address);

        egyptfi.process_payment(payment_id);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, owner);
        egyptfi.toggle_emergency_pause();
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.refund_payment(payment_id);
        stop_cheat_caller_address(egyptfi.contract_address);
    }
}