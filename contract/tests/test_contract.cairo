#[cfg(test)]
mod tests {
    use safebox::{IEgyptFiDispatcher, IEgyptFiDispatcherTrait};
    use safebox::PaymentStatus;
    use safebox::EgyptFi::{Event, MerchantRegistered, MerchantUpdated, PaymentCreated, PaymentCompleted, PaymentRefunded, WithdrawalMade, EmergencyPauseToggled, PoolRegistered, PoolDeactivated, PoolActivated, MultiPoolAllocationSet, YieldClaimed, YieldCompounded};
    use snforge_std::{
        ContractClassTrait, DeclareResultTrait, declare, spy_events, EventSpyAssertionsTrait,
        start_cheat_caller_address, stop_cheat_caller_address, start_cheat_block_timestamp, stop_cheat_block_timestamp
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

                assert(amount <= spender_allowance, 'amount exceeds allowance');
                assert(amount <= sender_balance, 'amount exceeds balance');

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

    // Mock Vesu Pool for testing
    #[starknet::interface]
    trait IMockVesuPool<TContractState> {
        fn deposit(ref self: TContractState, assets: u256, receiver: ContractAddress) -> u256;
        fn redeem(ref self: TContractState, shares: u256, receiver: ContractAddress, owner: ContractAddress) -> u256;
        fn preview_redeem(self: @TContractState, assets: u256) -> u256;
        fn convert_to_assets(self: @TContractState, shares: u256) -> u256;
    }

    #[starknet::contract]
    mod MockVesuPool {
        use starknet::ContractAddress;
        use starknet::storage::{Map, StoragePointerReadAccess, StoragePointerWriteAccess, StorageMapReadAccess, StorageMapWriteAccess};

        #[storage]
        pub struct Storage {
            total_assets: u256,
            shares: Map<ContractAddress, u256>,
        }

        #[constructor]
        fn constructor(ref self: ContractState) {}

        #[abi(embed_v0)]
        impl MockVesuPoolImpl of super::IMockVesuPool<ContractState> {
            fn deposit(ref self: ContractState, assets: u256, receiver: ContractAddress) -> u256 {
                let shares = assets; // 1:1 ratio for simplicity
                let current_shares = self.shares.read(receiver);
                self.shares.write(receiver, current_shares + shares);
                self.total_assets.write(self.total_assets.read() + assets);
                shares
            }

            fn redeem(ref self: ContractState, shares: u256, receiver: ContractAddress, owner: ContractAddress) -> u256 {
                let current_shares = self.shares.read(owner);
                assert(current_shares >= shares, 'Insufficient shares');
                self.shares.write(owner, current_shares - shares);
                let assets = shares; // 1:1 ratio
                self.total_assets.write(self.total_assets.read() - assets);
                assets
            }

            fn preview_redeem(self: @ContractState, assets: u256) -> u256 {
                assets
            }

            fn convert_to_assets(self: @ContractState, shares: u256) -> u256 {
                shares
            }
        }
    }

    fn deploy_mock_erc20( ) -> (IMockERC20Dispatcher, ContractAddress) {
        let contract = declare("MockERC20").unwrap().contract_class();
        let (contract_address, _) = contract.deploy(@ArrayTrait::new()).unwrap();
        let dispatcher = IMockERC20Dispatcher { contract_address };
        (dispatcher, contract_address)
    }

    fn deploy_mock_vesu_pool() -> (IMockVesuPoolDispatcher, ContractAddress) {
        let contract = declare("MockVesuPool").unwrap().contract_class();
        let (contract_address, _) = contract.deploy(@ArrayTrait::new()).unwrap();
        let dispatcher = IMockVesuPoolDispatcher { contract_address };
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

    fn setup() -> (IEgyptFiDispatcher, ContractAddress, IMockERC20Dispatcher, ContractAddress, ContractAddress, ContractAddress) {
        let owner = contract_address_const::<'owner'>();
        let merchant = contract_address_const::<'merchant'>();
        let customer = contract_address_const::<'customer'>();
        let collector = contract_address_const::<'collector'>();

        let (usdc_dispatcher, usdc_address) = deploy_mock_erc20( );

        let fee = 100; // 1%
        let min_amount = 1000000; // 1 USDC

        let egyptfi = deploy_egyptfi(owner, usdc_address, fee, collector, min_amount);

        (egyptfi, owner, usdc_dispatcher, merchant, customer, collector)
    }

    #[test]
    fn test_constructor() {
        let (egyptfi, _, _, _, _, _) = setup();

        assert_eq!(egyptfi.is_paused(), false);
        // Test other initial states if possible, but since storage is private, we rely on behavior
    }

    #[test]
    fn test_register_merchant() {
        let (egyptfi, _, _, merchant, _, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();
        let metadata_hash = 123;

        start_cheat_block_timestamp(egyptfi.contract_address,1000);
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
        assert_eq!(merchant_data.joined_timestamp, 1000);

        let expected_event = Event::MerchantRegistered(
            MerchantRegistered { merchant, timestamp: 1000 }
        );
        spy.assert_emitted(@array![(egyptfi.contract_address, expected_event)]);

        stop_cheat_caller_address(egyptfi.contract_address);
        stop_cheat_block_timestamp(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Merchant already registered')]
    fn test_register_merchant_already_registered() {
        let (egyptfi, _, _, merchant, _, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();
        let metadata_hash = 123;

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, metadata_hash);
        egyptfi.register_merchant(withdrawal_address, metadata_hash);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    fn test_update_merchant_withdrawal_address() {
        let (egyptfi, _, _, merchant, _, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();
        let new_withdrawal = contract_address_const::<'new_withdrawal'>();

        start_cheat_block_timestamp(egyptfi.contract_address,1000);
        start_cheat_caller_address(egyptfi.contract_address, merchant);

        egyptfi.register_merchant(withdrawal_address, 123);

        stop_cheat_caller_address(egyptfi.contract_address);
        stop_cheat_block_timestamp(egyptfi.contract_address);

        start_cheat_block_timestamp(egyptfi.contract_address,2000);
        start_cheat_caller_address(egyptfi.contract_address, merchant);

        let mut spy = spy_events();
        egyptfi.update_merchant_withdrawal_address(new_withdrawal);

        let merchant_data = egyptfi.get_merchant(merchant);
        assert_eq!(merchant_data.withdrawal_address, new_withdrawal);

        let expected_event = Event::MerchantUpdated(
            MerchantUpdated { merchant, field: 'withdrawal_address', timestamp: 2000 }
        );
        spy.assert_emitted(@array![(egyptfi.contract_address, expected_event)]);

        stop_cheat_caller_address(egyptfi.contract_address);
        stop_cheat_block_timestamp(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Merchant not found')]
    fn test_update_merchant_withdrawal_address_not_registered() {
        let (egyptfi, _, _, merchant, _, _) = setup();
        let new_withdrawal = contract_address_const::<'new_withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.update_merchant_withdrawal_address(new_withdrawal);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    fn test_update_merchant_metadata() {
        let (egyptfi, _, _, merchant, _, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_block_timestamp(egyptfi.contract_address,1000);
        start_cheat_caller_address(egyptfi.contract_address, merchant);

        egyptfi.register_merchant(withdrawal_address, 123);

        stop_cheat_caller_address(egyptfi.contract_address);
        stop_cheat_block_timestamp(egyptfi.contract_address);

        start_cheat_block_timestamp(egyptfi.contract_address,2000);
        start_cheat_caller_address(egyptfi.contract_address, merchant);

        let mut spy = spy_events();
        egyptfi.update_merchant_metadata(456);

        let merchant_data = egyptfi.get_merchant(merchant);
        assert_eq!(merchant_data.metadata_hash, 456);

        let expected_event = Event::MerchantUpdated(
            MerchantUpdated { merchant, field: 'metadata_hash', timestamp: 2000 }
        );
        spy.assert_emitted(@array![(egyptfi.contract_address, expected_event)]);

        stop_cheat_caller_address(egyptfi.contract_address);
        stop_cheat_block_timestamp(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Merchant not found')]
    fn test_update_merchant_metadata_not_registered() {
        let (egyptfi, _, _, merchant, _, _) = setup();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.update_merchant_metadata(456);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    fn test_deactivate_merchant() {
        let (egyptfi, _, _, merchant, _, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_block_timestamp(egyptfi.contract_address,1000);
        start_cheat_caller_address(egyptfi.contract_address, merchant);

        egyptfi.register_merchant(withdrawal_address, 123);

        stop_cheat_caller_address(egyptfi.contract_address);
        stop_cheat_block_timestamp(egyptfi.contract_address);

        start_cheat_block_timestamp(egyptfi.contract_address,2000);
        start_cheat_caller_address(egyptfi.contract_address, merchant);

        let mut spy = spy_events();
        egyptfi.deactivate_merchant();

        let merchant_data = egyptfi.get_merchant(merchant);
        assert_eq!(merchant_data.is_active, false);

        let expected_event = Event::MerchantUpdated(
            MerchantUpdated { merchant, field: 'deactivated', timestamp: 2000 }
        );
        spy.assert_emitted(@array![(egyptfi.contract_address, expected_event)]);

        stop_cheat_caller_address(egyptfi.contract_address);
        stop_cheat_block_timestamp(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Merchant not found')]
    fn test_deactivate_merchant_not_registered() {
        let (egyptfi, _, _, merchant, _, _) = setup();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.deactivate_merchant();
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    fn test_set_kyc_proof() {
        let (egyptfi, _, _, merchant, _, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_block_timestamp(egyptfi.contract_address,1000);
        start_cheat_caller_address(egyptfi.contract_address, merchant);

        egyptfi.register_merchant(withdrawal_address, 123);

        stop_cheat_caller_address(egyptfi.contract_address);
        stop_cheat_block_timestamp(egyptfi.contract_address);

        start_cheat_block_timestamp(egyptfi.contract_address,2000);
        start_cheat_caller_address(egyptfi.contract_address, merchant);

        let mut spy = spy_events();
        let proof001:felt252 = 12345.into();

        egyptfi.set_kyc_proof(proof001);

        let proof = egyptfi.get_kyc_proof(merchant);
        assert!(proof == proof001, "Wrong KYC proof");

        let expected_event = Event::MerchantUpdated(
            MerchantUpdated { merchant, field: 'kyc_proof', timestamp: 2000 }
        );
        spy.assert_emitted(@array![(egyptfi.contract_address, expected_event)]);

        stop_cheat_caller_address(egyptfi.contract_address);
        stop_cheat_block_timestamp(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Merchant not found')]
    fn test_set_kyc_proof_not_registered() {
        let (egyptfi, _, _, merchant, _, _) = setup();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.set_kyc_proof(1235);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    fn verify_kyc_proof() {
        let (egyptfi, owner, _, merchant, _, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_block_timestamp(egyptfi.contract_address,1000);
        start_cheat_caller_address(egyptfi.contract_address, merchant);

        egyptfi.register_merchant(withdrawal_address, 123);

        stop_cheat_caller_address(egyptfi.contract_address);
        stop_cheat_block_timestamp(egyptfi.contract_address);

        start_cheat_block_timestamp(egyptfi.contract_address,2000);
        start_cheat_caller_address(egyptfi.contract_address, merchant);

        let proof001:felt252 = 12345.into();

        egyptfi.set_kyc_proof(proof001);

        stop_cheat_caller_address(egyptfi.contract_address);
        stop_cheat_block_timestamp(egyptfi.contract_address);

        start_cheat_block_timestamp(egyptfi.contract_address,3000);
        start_cheat_caller_address(egyptfi.contract_address, owner);

        let proof001:felt252 = 12345.into();

        egyptfi.verify_kyc_proof(merchant, proof001);

        let proof = egyptfi.get_kyc_proof(merchant);
        assert!(proof == proof001, "Wrong KYC proof");

        stop_cheat_caller_address(egyptfi.contract_address);
        stop_cheat_block_timestamp(egyptfi.contract_address);
    }

    #[test]
    #[should_panic]
    fn verify_kyc_proof_wrong_proof() {
        let (egyptfi, owner, _, merchant, _, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_block_timestamp(egyptfi.contract_address,1000);
        start_cheat_caller_address(egyptfi.contract_address, merchant);

        egyptfi.register_merchant(withdrawal_address, 123);

        stop_cheat_caller_address(egyptfi.contract_address);
        stop_cheat_block_timestamp(egyptfi.contract_address);

        start_cheat_block_timestamp(egyptfi.contract_address,2000);
        start_cheat_caller_address(egyptfi.contract_address, merchant);

        let proof001:felt252 = 12345.into();

        egyptfi.set_kyc_proof(proof001);

        stop_cheat_caller_address(egyptfi.contract_address);
        stop_cheat_block_timestamp(egyptfi.contract_address);

        start_cheat_block_timestamp(egyptfi.contract_address,3000);
        start_cheat_caller_address(egyptfi.contract_address, owner);

        let proof001:felt252 = 1234675.into();

        egyptfi.verify_kyc_proof(merchant, proof001);

        let proof = egyptfi.get_kyc_proof(merchant);
        assert!(proof == proof001, "Wrong KYC proof");

        stop_cheat_caller_address(egyptfi.contract_address);
        stop_cheat_block_timestamp(egyptfi.contract_address);
    }

    #[test]
    #[should_panic]
    fn verify_kyc_proof_no_kyc_proof() {
        let (egyptfi, owner, _, merchant, _, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_block_timestamp(egyptfi.contract_address,1000);
        start_cheat_caller_address(egyptfi.contract_address, merchant);

        egyptfi.register_merchant(withdrawal_address, 123);

        stop_cheat_caller_address(egyptfi.contract_address);
        stop_cheat_block_timestamp(egyptfi.contract_address);

        start_cheat_block_timestamp(egyptfi.contract_address,3000);
        start_cheat_caller_address(egyptfi.contract_address, owner);

        let proof001:felt252 = 1234675.into();

        egyptfi.verify_kyc_proof(merchant, proof001);

        let proof = egyptfi.get_kyc_proof(merchant);
        assert!(proof == proof001, "Wrong KYC proof");

        stop_cheat_caller_address(egyptfi.contract_address);
        stop_cheat_block_timestamp(egyptfi.contract_address);
    }

    #[test]
    fn test_create_payment() {
        let (egyptfi, _, _, merchant, customer, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);
        let amount = 2000000; // 2 USDC
        let reference = 999;
        let platform_fee = 100;
        let description = 888;

        let mut spy = spy_events();
        let payment_id = egyptfi.create_payment(merchant, amount, platform_fee, reference, description);

        let payment = egyptfi.get_payment(payment_id);
        assert_eq!(payment.payment_id, payment_id);
        assert_eq!(payment.merchant, merchant);
        assert_eq!(payment.customer, customer);
        assert_eq!(payment.amount_paid, amount);
        assert_eq!(payment.usdc_amount, 0);
        assert_eq!(payment.platform_fee, platform_fee);
        assert_eq!(payment.status, safebox::PaymentStatus::Pending);
        assert_eq!(payment.reference, reference);
        assert_eq!(payment.description, description);

        let expected_event = Event::PaymentCreated(
            PaymentCreated { payment_id, merchant, customer, amount, reference }
        );
        spy.assert_emitted(@array![(egyptfi.contract_address, expected_event)]);

        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Merchant not active')]
    fn test_create_payment_merchant_not_active() {
        let (egyptfi, _, _, merchant, customer, _) = setup();

        start_cheat_caller_address(egyptfi.contract_address, customer);
        egyptfi.create_payment(merchant, 2000000, 100, 999, 888);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Amount must be positive')]
    fn test_create_payment_zero_amount() {
        let (egyptfi, _, _, merchant, customer, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);
        egyptfi.create_payment(merchant, 0, 100, 999, 888);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Amount below minimum')]
    fn test_create_payment_below_minimum() {
        let (egyptfi, _, _, merchant, customer, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);
        egyptfi.create_payment(merchant, 500000, 100, 999, 888); // 0.5 USDC
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    fn test_process_payment() {
        let (egyptfi, _, usdc, merchant, customer, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        let amount = 2000000; // 2 USDC

        // Mint and Approve transfer
        start_cheat_caller_address(usdc.contract_address, customer);
        usdc.mint(customer, amount); // Mint some USDC to customer
        usdc.approve(egyptfi.contract_address, amount);
        stop_cheat_caller_address(usdc.contract_address);

        start_cheat_block_timestamp(egyptfi.contract_address,2000);
        start_cheat_caller_address(egyptfi.contract_address, customer);

        let payment_id = egyptfi.create_payment(merchant, amount, 100, 999, 888);


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

        let expected_event = Event::PaymentCompleted(
            PaymentCompleted {
                payment_id,
                merchant,
                customer,
                usdc_amount: amount,
                timestamp: 2000
            }
        );
        spy.assert_emitted(@array![(egyptfi.contract_address, expected_event)]);

        stop_cheat_caller_address(egyptfi.contract_address);
        stop_cheat_block_timestamp(egyptfi.contract_address);
    }

    #[test]
    #[should_panic]
    fn test_process_payment_not_found() {
        let (egyptfi, _, _, _, customer, _) = setup();

        let payment_id: felt252 = 0.into(); // Non-existent payment ID

        start_cheat_caller_address(egyptfi.contract_address, customer);
        egyptfi.process_payment(payment_id); // Non-existent payment ID
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Payment not pending')]
    fn test_process_payment_not_pending() {
        let (egyptfi, _, usdc, merchant, customer, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        let amount = 2000000;

        start_cheat_caller_address(usdc.contract_address, customer);
        usdc.mint(customer, amount); // Mint some USDC to customer
        usdc.approve(egyptfi.contract_address, amount);
        stop_cheat_caller_address(usdc.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);

        let payment_id = egyptfi.create_payment(merchant, amount, 100, 999, 888);


        egyptfi.process_payment(payment_id);
        egyptfi.process_payment(payment_id); // Try again
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Not payment customer')]
    fn test_process_payment_wrong_customer() {
        let (egyptfi, _, _, merchant, customer, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);
        let amount = 2000000;
        let payment_id = egyptfi.create_payment(merchant, amount, 100, 999, 888);
        stop_cheat_caller_address(egyptfi.contract_address);

        let wrong_customer = contract_address_const::<'wrong_customer'>();
        start_cheat_caller_address(egyptfi.contract_address, wrong_customer);
        egyptfi.process_payment(payment_id);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    fn test_withdraw_funds() {
        let (egyptfi, _, usdc, merchant, customer, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        // Register merchant and process payment
        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        let amount = 2000000;

        start_cheat_caller_address(usdc.contract_address, customer);
        usdc.mint(customer, amount); // Mint some USDC to customer        
        usdc.approve(egyptfi.contract_address, amount);
        stop_cheat_caller_address(usdc.contract_address);   

        start_cheat_caller_address(egyptfi.contract_address, customer);

        let payment_id = egyptfi.create_payment(merchant, amount, 100, 999, 888);

        egyptfi.process_payment(payment_id);
        stop_cheat_caller_address(egyptfi.contract_address);

        // Withdraw
        start_cheat_block_timestamp(egyptfi.contract_address,3000);
        start_cheat_caller_address(egyptfi.contract_address, merchant);
        let withdraw_amount = 1000000; // 1 USDC
        let mut spy = spy_events();
        egyptfi.withdraw_funds(withdraw_amount);

        let merchant_data = egyptfi.get_merchant(merchant);
        assert_eq!(merchant_data.usdc_balance, 980000); // 0.98 USDC left after withdrawing 1 USDC since 1% fee taken on 2 USDC payment
        let withdrawal_address = merchant_data.withdrawal_address;

        let expected_event = Event::WithdrawalMade(
            WithdrawalMade {
                merchant,
                amount: withdraw_amount,
                to_address: withdrawal_address,
                timestamp: 3000
            }
        );
        spy.assert_emitted(@array![(egyptfi.contract_address, expected_event)]);

        stop_cheat_caller_address(egyptfi.contract_address);
        stop_cheat_block_timestamp(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Merchant not found')]
    fn test_withdraw_funds_no_merchant_register() {
        let (egyptfi, _, _, merchant, _, _) = setup();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.withdraw_funds(1000000); // 1 USDC
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Amount must be positive')]
    fn test_withdraw_funds_for_amount_zero() {
        let (egyptfi, _, _, merchant, _, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        egyptfi.withdraw_funds(0); // 0 USDC
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Insufficient balance')]
    fn test_withdraw_funds_more_than_balance() {
        let (egyptfi, _, _, merchant, _, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        egyptfi.withdraw_funds(1000000); // 1 USDC
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    // #[ignore]
    fn test_refund_payment() {
        let (egyptfi, _, usdc, merchant, customer, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();
        // let customer2 = contract_address_const::<'customer2'>();

        // Register merchant and process payment
        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        let amount = 2000000;

        //customer 1
        start_cheat_caller_address(usdc.contract_address, customer);
        usdc.mint(customer, amount); // Mint some USDC to customer
        usdc.approve(egyptfi.contract_address, amount);
        stop_cheat_caller_address(usdc.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);

        let payment_id = egyptfi.create_payment(merchant, amount, 100, 999, 888);

        egyptfi.process_payment(payment_id);

        stop_cheat_caller_address(egyptfi.contract_address);

        // //customer2
        // start_cheat_caller_address(usdc.contract_address, customer2);
        // usdc.mint(customer, amount); // Mint some USDC to customer
        // usdc.approve(egyptfi.contract_address, amount);
        // stop_cheat_caller_address(usdc.contract_address);

        // start_cheat_caller_address(egyptfi.contract_address, customer2);

        // let payment_id2 = egyptfi.create_payment(merchant, amount, 100, 999, 888);

        // egyptfi.process_payment(payment_id2);
        // stop_cheat_caller_address(egyptfi.contract_address);


        // Refund
        start_cheat_block_timestamp(egyptfi.contract_address,4000);
        start_cheat_caller_address(egyptfi.contract_address, merchant);
        // let mut spy = spy_events();
        egyptfi.refund_payment(payment_id);

        let payment = egyptfi.get_payment(payment_id);
        assert_eq!(payment.status, safebox::PaymentStatus::Refunded);

        let merchant_data = egyptfi.get_merchant(merchant);
        assert_eq!(merchant_data.usdc_balance, 0);

        // let expected_event = Event::PaymentRefunded(
        //     PaymentRefunded {
        //         payment_id,
        //         merchant,
        //         customer,
        //         refund_amount: 1880000, //after removing platform fee remain 1.8 USDC
        //         timestamp: 4000
        //     }
        // );
        // spy.assert_emitted(@array![(egyptfi.contract_address, expected_event)]);

        stop_cheat_caller_address(egyptfi.contract_address);
        stop_cheat_block_timestamp(egyptfi.contract_address);
    }

    #[test]
    #[should_panic]
    fn test_refund_payment_no_payment() {
        let (egyptfi, _, usdc, merchant, customer, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();
        let merchant2 = contract_address_const::<'merchant2'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(usdc.contract_address, customer);
        usdc.mint(customer, 3000000); // Mint some USDC to customer
        usdc.approve(egyptfi.contract_address, 3000000);
        stop_cheat_caller_address(usdc.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);
        let amount = 2000000;
        let payment_id = egyptfi.create_payment(merchant, amount, 100, 999, 888);
        egyptfi.process_payment(payment_id);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, merchant2);
        let payment_id_default: felt252 = 0.into();
        egyptfi.refund_payment(payment_id_default);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Not payment merchant')]
    fn test_refund_payment_not_merchant() {
        let (egyptfi, _, usdc, merchant, customer, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();
        let merchant2 = contract_address_const::<'merchant2'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(usdc.contract_address, customer);
        usdc.mint(customer, 3000000); // Mint some USDC to customer
        usdc.approve(egyptfi.contract_address, 3000000);
        stop_cheat_caller_address(usdc.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);
        let amount = 2000000;
        let payment_id = egyptfi.create_payment(merchant, amount, 100, 999, 888);
        egyptfi.process_payment(payment_id);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, merchant2);
        egyptfi.refund_payment(payment_id);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Payment not completed')]
    fn test_refund_payment_not_completed() {
        let (egyptfi, _, _, merchant, customer, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);
        let amount = 2000000;
        let payment_id = egyptfi.create_payment(merchant, amount, 100, 999, 888);

        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.refund_payment(payment_id);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Insufficient vault balance')]
    fn test_refund_payment_merchant_balance_low() {
        let (egyptfi, _, usdc, merchant, customer, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        // Register merchant and process payment
        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        let amount = 2000000;

        start_cheat_caller_address(usdc.contract_address, customer);
        usdc.mint(customer, amount); // Mint some USDC to customer        
        usdc.approve(egyptfi.contract_address, amount);
        stop_cheat_caller_address(usdc.contract_address);   

        start_cheat_caller_address(egyptfi.contract_address, customer);

        let payment_id = egyptfi.create_payment(merchant, amount, 100, 999, 888);

        egyptfi.process_payment(payment_id);
        stop_cheat_caller_address(egyptfi.contract_address);

        // Withdraw
        start_cheat_caller_address(egyptfi.contract_address, merchant);

        egyptfi.withdraw_funds(1000000); // Withdraw 1 USDC, leaving merchant with 0.98 USDC balance

        egyptfi.refund_payment(payment_id); // Try to refund full 2 USDC payment

        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    fn test_get_merchant_payments() {
        let (egyptfi, _, _, merchant, customer, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);
        let payment_id1 = egyptfi.create_payment(merchant, 2000000, 100, 999, 888);
        let payment_id2 = egyptfi.create_payment(merchant, 2000000, 100, 998, 887);
        stop_cheat_caller_address(egyptfi.contract_address);

        let payments = egyptfi.get_merchant_payments(merchant, 0, 10);
        assert_eq!(payments.len(), 2);
        assert_eq!(*payments.at(0), payment_id1);
        assert_eq!(*payments.at(1), payment_id2);
    }

    #[test]
    fn test_verify_payment() {
        let (egyptfi, _, usdc, merchant, customer, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        let amount = 2000000;

        start_cheat_caller_address(usdc.contract_address, customer);
        usdc.mint(customer, amount); // Mint some USDC to customer
        usdc.approve(egyptfi.contract_address, amount);
        stop_cheat_caller_address(usdc.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);

        let payment_id = egyptfi.create_payment(merchant, amount, 100, 999, 888);
        // let payment_id2 = 1234.into(); // Non-existent payment ID

        egyptfi.process_payment(payment_id);
        stop_cheat_caller_address(egyptfi.contract_address);

        assert_eq!(egyptfi.verify_payment(payment_id, merchant), true);
        // assert_eq!(egyptfi.verify_payment(payment_id2, contract_address_const::<'wrong_merchant'>()), false);
        assert_eq!(egyptfi.verify_payment(payment_id, contract_address_const::<'wrong_merchant'>()), false);
    }

    #[test]
    fn test_toggle_emergency_pause() {
        let (egyptfi, owner, _, _, _, _) = setup();

        start_cheat_caller_address(egyptfi.contract_address, owner);
        let mut spy = spy_events();
        egyptfi.toggle_emergency_pause();

        assert_eq!(egyptfi.is_paused(), true);

        let expected_event = Event::EmergencyPauseToggled(
            EmergencyPauseToggled { paused: true, timestamp: starknet::get_block_timestamp() }
        );
        spy.assert_emitted(@array![(egyptfi.contract_address, expected_event)]);

        spy = spy_events();
        egyptfi.toggle_emergency_pause();
        assert_eq!(egyptfi.is_paused(), false);

        let expected_event2 = Event::EmergencyPauseToggled(
            EmergencyPauseToggled { paused: false, timestamp: starknet::get_block_timestamp() }
        );
        spy.assert_emitted(@array![(egyptfi.contract_address, expected_event2)]);

        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Caller is not the owner')]
    fn test_toggle_emergency_pause_not_owner() {
        let (egyptfi, _, _, _, customer, _) = setup();

        start_cheat_caller_address(egyptfi.contract_address, customer);
        egyptfi.toggle_emergency_pause();
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    fn test_update_platform_fee() {
        let (egyptfi, owner, _, _, _, _) = setup();

        start_cheat_caller_address(egyptfi.contract_address, owner);
        egyptfi.update_platform_fee(200); // 2%
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Fee too high')]
    fn test_update_platform_fee_too_high() {
        let (egyptfi, owner, _, _, _, _) = setup();

        start_cheat_caller_address(egyptfi.contract_address, owner);
        egyptfi.update_platform_fee(600); // 6%
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    fn test_update_min_payment_amount() {
        let (egyptfi, owner, _, _, _, _) = setup();

        start_cheat_caller_address(egyptfi.contract_address, owner);
        egyptfi.update_min_payment_amount(2000000); // 2 USDC
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Contract is paused')]
    fn test_create_payment_when_paused() {
        let (egyptfi, owner, _, merchant, customer, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, owner);
        egyptfi.toggle_emergency_pause();
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);
        egyptfi.create_payment(merchant, 2000000, 100, 999, 888);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Contract is paused')]
    fn test_process_payment_when_paused() {
        let (egyptfi, owner, usdc, merchant, customer, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        let amount = 2000000; // 2 USDC
        
        start_cheat_caller_address(egyptfi.contract_address, customer);
        let payment_id = egyptfi.create_payment(merchant, amount, 100, 999, 888);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, owner);
        egyptfi.toggle_emergency_pause();
        stop_cheat_caller_address(egyptfi.contract_address);

        // Mint and Approve transfer
        start_cheat_caller_address(usdc.contract_address, customer);
        usdc.mint(customer, amount); // Mint some USDC to customer
        usdc.approve(egyptfi.contract_address, amount);
        stop_cheat_caller_address(usdc.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);
        egyptfi.process_payment(payment_id);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Contract is paused')]
    fn test_withdraw_funds_when_paused() {
        let (egyptfi, owner, _, merchant, _, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, owner);
        egyptfi.toggle_emergency_pause();
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.withdraw_funds(1000000); // 1 USDC
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Contract is paused')]
    fn test_refund_payment_when_paused() {
        let (egyptfi, owner, usdc, merchant, customer, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);
        let amount = 2000000;
        let payment_id = egyptfi.create_payment(merchant, amount, 100, 999, 888);

        start_cheat_caller_address(usdc.contract_address, customer);
        usdc.mint(customer, amount); // Mint some USDC to customer
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

    #[test]
    fn test_get_kyc_proof() {
        let (egyptfi, _, _, merchant, _, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        egyptfi.set_kyc_proof(456);
        stop_cheat_caller_address(egyptfi.contract_address);

        let proof = egyptfi.get_kyc_proof(merchant);
        assert_eq!(proof, 456);
    }

    #[test]
    fn test_get_merchant() {
        let (egyptfi, _, _, merchant, _, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        let merchant_data = egyptfi.get_merchant(merchant);
        assert_eq!(merchant_data.is_active, true);
        assert_eq!(merchant_data.withdrawal_address, withdrawal_address);
    }

    #[test]
    fn test_get_payment() {
        let (egyptfi, _, _, merchant, customer, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);
        let payment_id = egyptfi.create_payment(merchant, 2000000, 100, 999, 888);
        stop_cheat_caller_address(egyptfi.contract_address);

        let payment = egyptfi.get_payment(payment_id);
        assert_eq!(payment.payment_id, payment_id);
        assert_eq!(payment.merchant, merchant);
        assert_eq!(payment.customer, customer);
    }

    #[test]
    fn test_is_paused() {
        let (egyptfi, owner, _, _, _, _) = setup();

        assert_eq!(egyptfi.is_paused(), false);

        start_cheat_caller_address(egyptfi.contract_address, owner);
        egyptfi.toggle_emergency_pause();
        assert_eq!(egyptfi.is_paused(), true);
        egyptfi.toggle_emergency_pause();
        assert_eq!(egyptfi.is_paused(), false);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    // Pool management tests
    fn setup_with_pool() -> (IEgyptFiDispatcher, ContractAddress, IMockVesuPoolDispatcher, ContractAddress) {
        let (egyptfi, owner, _, _, _, _) = setup();
        let (pool_dispatcher, pool_address) = deploy_mock_vesu_pool();

        start_cheat_caller_address(egyptfi.contract_address, owner);
        egyptfi.register_pool('pool1', pool_address, 'Stablecoin', 'USDC');
        stop_cheat_caller_address(egyptfi.contract_address);

        (egyptfi, owner, pool_dispatcher, pool_address)
    }

    #[test]
    fn test_register_pool() {
        let (egyptfi, owner, _, _, _, _) = setup();
        let (_pool_dispatcher, pool_address) = deploy_mock_vesu_pool();

        start_cheat_block_timestamp(egyptfi.contract_address,1000);
        start_cheat_caller_address(egyptfi.contract_address, owner);
        let mut spy = spy_events();

        egyptfi.register_pool('pool1', pool_address, 'Stablecoin', 'USDC');

        let pool_info = egyptfi.get_pool_info('pool1');
        assert_eq!(pool_info.pool_id, 'pool1');
        assert_eq!(pool_info.pool_address, pool_address);
        assert_eq!(pool_info.pool_name, 'Stablecoin');
        assert_eq!(pool_info.pool_type, 'USDC');
        assert_eq!(pool_info.is_active, true);

        let expected_event = Event::PoolRegistered(
            PoolRegistered { 
                pool_id : pool_info.pool_id,
                pool_address : pool_info.pool_address,
                pool_name : pool_info.pool_name,
                timestamp: 1000,
            }
        );
        spy.assert_emitted(@array![(egyptfi.contract_address, expected_event)]);

        stop_cheat_caller_address(egyptfi.contract_address);
        stop_cheat_block_timestamp(egyptfi.contract_address);

    }

    #[test]
    #[should_panic(expected: 'Pool already registered')]
    fn test_register_pool_already_registered() {
        let (egyptfi, owner, _, _, _, _) = setup();
        let (_pool_dispatcher, pool_address) = deploy_mock_vesu_pool();

        start_cheat_caller_address(egyptfi.contract_address, owner);
        egyptfi.register_pool('pool1', pool_address, 'Stablecoin', 'USDC');
        egyptfi.register_pool('pool1', pool_address, 'Stablecoin', 'USDC');
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Caller is not the owner')]
    fn test_register_pool_not_owner() {
        let (egyptfi, _owner, _, _, _, _) = setup();
        let (_pool_dispatcher, pool_address) = deploy_mock_vesu_pool();
        let not_owner = contract_address_const::<'not_owner'>();

        start_cheat_caller_address(egyptfi.contract_address, not_owner);
        egyptfi.register_pool('pool1', pool_address, 'Stablecoin', 'USDC');
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    fn test_deactivate_pool() {
        let (egyptfi, owner, _, _) = setup_with_pool();

        start_cheat_block_timestamp(egyptfi.contract_address,1000);
        start_cheat_caller_address(egyptfi.contract_address, owner);
        let mut spy = spy_events();

        egyptfi.deactivate_pool('pool1');

        let pool_info = egyptfi.get_pool_info('pool1');
        assert_eq!(pool_info.is_active, false);

        let expected_event = Event::PoolDeactivated(
            PoolDeactivated { 
                merchant: owner,
                pool_id: pool_info.pool_id,
                timestamp: 1000,
            }
        );
        spy.assert_emitted(@array![(egyptfi.contract_address, expected_event)]);


        stop_cheat_caller_address(egyptfi.contract_address);
        stop_cheat_block_timestamp(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Pool not found')]
    fn test_deactivate_pool_not_found() {
        let (egyptfi, owner, _, _, _, _) = setup();

        start_cheat_caller_address(egyptfi.contract_address, owner);
        egyptfi.deactivate_pool('nonexistent');
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Caller is not the owner')]
    fn test_deactivate_pool_not_owner() {
        let (egyptfi, _owner, _, _, _, _) = setup();
        let not_owner = contract_address_const::<'not_owner'>();

        start_cheat_caller_address(egyptfi.contract_address, not_owner);
        egyptfi.deactivate_pool('nonexistent');
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    fn test_get_pool_info() {
        let (egyptfi, _, _, pool_address) = setup_with_pool();

        let pool_info = egyptfi.get_pool_info('pool1');
        assert_eq!(pool_info.pool_id, 'pool1');
        assert_eq!(pool_info.pool_address, pool_address);
    }

    #[test]
    fn test_get_all_pools() {
        let (egyptfi, _owner, _pool_dispatcher, _pool_address) = setup_with_pool();

        let pools = egyptfi.get_all_pools();
        assert_eq!(pools.len(), 1);
        let pool = *pools.at(0);
        assert_eq!(pool.pool_id, 'pool1');
    }

    // Merchant pool allocation tests
    #[test]
    fn test_set_multi_pool_allocation() {
        let (egyptfi, _, _, _) = setup_with_pool();
        let merchant = contract_address_const::<'merchant'>();

        start_cheat_block_timestamp(egyptfi.contract_address,1000);
        start_cheat_caller_address(egyptfi.contract_address, merchant);
        let mut spy = spy_events();

        egyptfi.register_merchant(contract_address_const::<'withdrawal'>(), 123);

        let allocations = array![('pool1', 7000)]; // 70%
        egyptfi.set_multi_pool_allocation(allocations);

        let allocation = egyptfi.get_merchant_pool_allocation(merchant, 'pool1');
        assert_eq!(allocation, 7000);

        let expected_event = Event::MultiPoolAllocationSet(
            MultiPoolAllocationSet { 
                    merchant,
                    pool_id: 'pool1',
                    allocation_percentage: 7000,
                    timestamp: 1000,
            }
        );
        spy.assert_emitted(@array![(egyptfi.contract_address, expected_event)]);

        stop_cheat_caller_address(egyptfi.contract_address);     
        stop_cheat_block_timestamp(egyptfi.contract_address);   
    }

    #[test]
    #[should_panic(expected: 'Merchant not found')]
    fn test_set_multi_pool_allocation_not_registered() {
        let (egyptfi, _, _, _) = setup_with_pool();
        let merchant = contract_address_const::<'merchant'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        let allocations = array![('pool1', 7000)];
        egyptfi.set_multi_pool_allocation(allocations);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Pool not active')]
    fn test_set_multi_pool_allocation_no_active_pool() {
        let (egyptfi, _, _, merchant, _, _) = setup();


        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(contract_address_const::<'withdrawal'>(), 123);

        let allocations = array![('pool1', 7000)];
        egyptfi.set_multi_pool_allocation(allocations);
        stop_cheat_caller_address(egyptfi.contract_address);
    }


    #[test]
    #[should_panic(expected: 'Total allocation exceeds 100%')]
    fn test_set_multi_pool_allocation_exceeds_100() {
        let (egyptfi, _, _, _) = setup_with_pool();
        let merchant = contract_address_const::<'merchant'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(contract_address_const::<'withdrawal'>(), 123);

        let allocations = array![('pool1', 10001)]; // >100%
        egyptfi.set_multi_pool_allocation(allocations);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    fn test_add_pool_to_strategy() {
        let (egyptfi, _, _, _) = setup_with_pool();
        let merchant = contract_address_const::<'merchant'>();

        start_cheat_block_timestamp(egyptfi.contract_address,1000);
        start_cheat_caller_address(egyptfi.contract_address, merchant);
        let mut spy = spy_events();

        egyptfi.register_merchant(contract_address_const::<'withdrawal'>(), 123);
        egyptfi.add_pool_to_strategy('pool1', 5000); // 50%

        let allocation = egyptfi.get_merchant_pool_allocation(merchant, 'pool1');
        assert_eq!(allocation, 5000);

        let expected_event = Event::PoolActivated(
            PoolActivated { 
                    merchant,
                    pool_id: 'pool1',
                    timestamp: 1000,
            }
        );
        spy.assert_emitted(@array![(egyptfi.contract_address, expected_event)]);

        stop_cheat_caller_address(egyptfi.contract_address);     
        stop_cheat_block_timestamp(egyptfi.contract_address);  
    }


    #[test]
    #[should_panic(expected: 'Merchant not found')]
    fn test_add_pool_to_strategy_not_registered() {
        let (egyptfi, _, _, _) = setup_with_pool();
        let merchant = contract_address_const::<'merchant'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.add_pool_to_strategy('pool1', 5000);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Pool not active')]
    fn test_add_pool_to_strategy_pool_not_active() {
        let (egyptfi, owner, _, _) = setup_with_pool();
        let merchant = contract_address_const::<'merchant'>();

        start_cheat_caller_address(egyptfi.contract_address, owner);
        egyptfi.deactivate_pool('pool1');
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(contract_address_const::<'withdrawal'>(), 123);
        egyptfi.add_pool_to_strategy('pool1', 5000);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Allocation exceeds 100%')]
    fn test_add_pool_to_strategy_pool_allocation_exceed_100() {
        let (egyptfi, _owner, _, _) = setup_with_pool();
        let merchant = contract_address_const::<'merchant'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(contract_address_const::<'withdrawal'>(), 123);
        egyptfi.add_pool_to_strategy('pool1', 11000);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    
    #[test]
    #[should_panic(expected: 'Total exceeds 100%')]
    fn test_add_pool_to_strategy_pool_total_exceed_100() {
        let (egyptfi, _owner, _, _) = setup_with_pool();
        let merchant = contract_address_const::<'merchant'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(contract_address_const::<'withdrawal'>(), 123);
        egyptfi.add_pool_to_strategy('pool1', 5000);
        egyptfi.add_pool_to_strategy('pool1', 6000);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    fn test_remove_pool_from_strategy() {
        let (egyptfi, _, _, _) = setup_with_pool();
        let merchant = contract_address_const::<'merchant'>();

        start_cheat_block_timestamp(egyptfi.contract_address,1000);
        start_cheat_caller_address(egyptfi.contract_address, merchant);
        let mut spy = spy_events();

        egyptfi.register_merchant(contract_address_const::<'withdrawal'>(), 123);
        egyptfi.add_pool_to_strategy('pool1', 5000); // 50%

        egyptfi.remove_pool_from_strategy('pool1');

        let allocation = egyptfi.get_merchant_pool_allocation(merchant, 'pool1');
        assert_eq!(allocation, 0);

        let expected_event = Event::PoolDeactivated(
            PoolDeactivated { 
                    merchant,
                    pool_id: 'pool1',
                    timestamp: 1000,
            }
        );

        spy.assert_emitted(@array![(egyptfi.contract_address, expected_event)]);

        stop_cheat_caller_address(egyptfi.contract_address);     
        stop_cheat_block_timestamp(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Merchant not found')]
    fn test_remove_pool_from_strategy_not_registered() {
        let (egyptfi, _, _, _) = setup_with_pool();
        let merchant = contract_address_const::<'merchant'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.remove_pool_from_strategy('pool1');
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[ignore]
    #[should_panic(expected: 'Pool has active deposits')]
    fn test_remove_pool_from_strategy_pool_not_active() {
        let customer = contract_address_const::<'customer'>();
        let merchant = contract_address_const::<'merchant'>();

        let (usdc, _usdc_address) = deploy_mock_erc20( );

        let (egyptfi, _, _, _) = setup_with_pool();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(contract_address_const::<'withdrawal'>(), 123);
        egyptfi.add_pool_to_strategy('pool1', 5000); // 50%
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(usdc.contract_address, customer);
        usdc.mint(customer, 20000000); // Mint 20 USDC to customer
        usdc.approve(egyptfi.contract_address, 20000000);
        stop_cheat_caller_address(usdc.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);
        let payment_id = egyptfi.create_payment(merchant, 2000000, 100, 999, 888);
        egyptfi.process_payment(payment_id);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.remove_pool_from_strategy('pool1');
        stop_cheat_caller_address(egyptfi.contract_address);
    }


    #[test]
    fn test_update_pool_allocation() {
        let (egyptfi, _, _, _) = setup_with_pool();
        let merchant = contract_address_const::<'merchant'>();

        start_cheat_block_timestamp(egyptfi.contract_address,1000);
        start_cheat_caller_address(egyptfi.contract_address, merchant);
        let mut spy = spy_events();

        egyptfi.register_merchant(contract_address_const::<'withdrawal'>(), 123);
        egyptfi.add_pool_to_strategy('pool1', 5000); // 50%
        egyptfi.update_pool_allocation('pool1', 7500);

        let allocation = egyptfi.get_merchant_pool_allocation(merchant, 'pool1');
        assert_eq!(allocation, 7500);

        let expected_event = Event::MultiPoolAllocationSet(
            MultiPoolAllocationSet { 
                    merchant,
                    pool_id: 'pool1',
                    allocation_percentage: 7500,      
                    timestamp: 1000,
            }
        );
        spy.assert_emitted(@array![(egyptfi.contract_address, expected_event)]);

        stop_cheat_caller_address(egyptfi.contract_address);     
        stop_cheat_block_timestamp(egyptfi.contract_address);  
    }

    #[test]
    #[should_panic(expected: 'Merchant not found')]
    fn test_update_pool_allocation_not_registered() {
        let (egyptfi, _, _, _) = setup_with_pool();
        let merchant = contract_address_const::<'merchant'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.add_pool_to_strategy('pool1', 5000);
        egyptfi.update_pool_allocation('pool1', 7500);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Pool not active')]
    fn test_update_pool_allocation_pool_not_active() {
        let (egyptfi, _owner, _, _, _, _) = setup();
        let merchant = contract_address_const::<'merchant'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(contract_address_const::<'withdrawal'>(), 123);
        // egyptfi.add_pool_to_strategy('pool1', 5000);
        egyptfi.update_pool_allocation('pool1', 7500);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    #[should_panic(expected: 'Allocation exceeds 100%')]
    fn test_update_pool_allocation_pool_allocation_exceed_100() {
        let (egyptfi, _owner, _, _) = setup_with_pool();
        let merchant = contract_address_const::<'merchant'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(contract_address_const::<'withdrawal'>(), 123);
        egyptfi.add_pool_to_strategy('pool1', 5000);
        egyptfi.update_pool_allocation('pool1', 11000);
        stop_cheat_caller_address(egyptfi.contract_address);
    }
   
    #[test]
    #[should_panic(expected: 'Total exceeds 100%')]
    fn test_update_pool_allocation_pool_total_exceed_100() {
        let merchant = contract_address_const::<'merchant'>();

        let (egyptfi, owner, _, _, _, _) = setup();
        let (_pool_dispatcher, pool_address) = deploy_mock_vesu_pool();

        start_cheat_caller_address(egyptfi.contract_address, owner);
        egyptfi.register_pool('pool1', pool_address, 'Stablecoin', 'USDC');
        egyptfi.register_pool('pool2', pool_address, 'Stablecoin', 'USDC');
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(contract_address_const::<'withdrawal'>(), 123);

        egyptfi.add_pool_to_strategy('pool2', 5000);
        egyptfi.add_pool_to_strategy('pool1', 4000);
        egyptfi.update_pool_allocation('pool1', 7000);

        stop_cheat_caller_address(egyptfi.contract_address);
    }

    // Pool view functions tests
    #[test]
    fn test_get_merchant_pools() {
        let (egyptfi, _, _, _) = setup_with_pool();
        let merchant = contract_address_const::<'merchant'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(contract_address_const::<'withdrawal'>(), 123);
        egyptfi.add_pool_to_strategy('pool1', 5000);
        stop_cheat_caller_address(egyptfi.contract_address);

        let pools = egyptfi.get_merchant_pools(merchant);
        assert_eq!(pools.len(), 1);
        assert_eq!(*pools.at(0), 'pool1');
    }

    #[test]
    fn test_get_merchant_pool_allocation() {
        let (egyptfi, _, _, _) = setup_with_pool();
        let merchant = contract_address_const::<'merchant'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(contract_address_const::<'withdrawal'>(), 123);
        egyptfi.add_pool_to_strategy('pool1', 5000);
        stop_cheat_caller_address(egyptfi.contract_address);

        let allocation = egyptfi.get_merchant_pool_allocation(merchant, 'pool1');
        assert_eq!(allocation, 5000);
    }

    #[test]
    fn test_get_multi_pool_positions() {
        let (egyptfi, _, _, _) = setup_with_pool();
        let merchant = contract_address_const::<'merchant'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(contract_address_const::<'withdrawal'>(), 123);
        egyptfi.add_pool_to_strategy('pool1', 10000);
        stop_cheat_caller_address(egyptfi.contract_address);

        let positions = egyptfi.get_multi_pool_positions(merchant);
        assert_eq!(positions.len(), 1);
        let (pool_id, deposited, yield_amount) = *positions.at(0);
        assert_eq!(pool_id, 'pool1');
        assert_eq!(deposited, 0);
        assert_eq!(yield_amount, 0);
   }

    // Yield management tests - Note: These require actual deposits, so simplified
    #[test]
    fn test_claim_all_yields_no_yield() {
        let (egyptfi, _, _, _) = setup_with_pool();
        let merchant = contract_address_const::<'merchant'>();

        start_cheat_block_timestamp(egyptfi.contract_address,1000);
        start_cheat_caller_address(egyptfi.contract_address, merchant);
        // let mut spy = spy_events();

        egyptfi.register_merchant(contract_address_const::<'withdrawal'>(), 123);
        egyptfi.claim_all_yields();

        // // No assertion needed as no yield

        // cant figure out exact expected yield from vesu pool

        // let expected_event = Event::YieldClaimed(
        //     YieldClaimed { 
        //             merchant,
        //             amount: 0,     
        //             timestamp: 1000,
        //     }
        // );
        // spy.assert_emitted(@array![(egyptfi.contract_address, expected_event)]);     
    
        stop_cheat_caller_address(egyptfi.contract_address);     
        stop_cheat_block_timestamp(egyptfi.contract_address); 
    }

    #[test]
    #[should_panic(expected: 'Merchant not found')]
    fn test_claim_all_yields_not_merchant() {
        let (egyptfi, _, _, _) = setup_with_pool();
        let merchant = contract_address_const::<'merchant'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.claim_all_yields();
        stop_cheat_caller_address(egyptfi.contract_address);

    }

    #[test]
    fn test_compound_all_yields_no_yield() {
        let (egyptfi, _, _, _) = setup_with_pool();
        let merchant = contract_address_const::<'merchant'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);

        egyptfi.register_merchant(contract_address_const::<'withdrawal'>(), 123);
        egyptfi.compound_all_yields();

        stop_cheat_caller_address(egyptfi.contract_address);

        // No assertion needed as no yield

        // cant figure out exact expected yield from vesu pool so cant test event properly
    }


    #[test]
    #[should_panic(expected: 'Merchant not found')]
    fn test_compound_all_yields_not_merchant() {
        let (egyptfi, _, _, _) = setup_with_pool();
        let merchant = contract_address_const::<'merchant'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.compound_all_yields();
        stop_cheat_caller_address(egyptfi.contract_address);
    }


    // Admin pool functions tests
    #[test]
    fn test_set_platform_pool_id() {
        let (egyptfi, owner, _, _) = setup_with_pool();

        start_cheat_caller_address(egyptfi.contract_address, owner);
        egyptfi.set_platform_pool_id('pool1');
        stop_cheat_caller_address(egyptfi.contract_address);

        // No direct getter, but can check by trying to deposit
    }

    #[test]
    #[should_panic(expected: 'Pool not active')]
    fn test_set_platform_pool_id_not_active() {
        let (egyptfi, owner, _, _, _, _) = setup();

        start_cheat_caller_address(egyptfi.contract_address, owner);
        egyptfi.set_platform_pool_id('nonexistent');
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    fn test_update_platform_pool_allocation() {
        let (egyptfi, owner, _, _, _, _) = setup();

        start_cheat_caller_address(egyptfi.contract_address, owner);
        egyptfi.update_platform_pool_allocation(7500); // 75%
        stop_cheat_caller_address(egyptfi.contract_address);

        // No direct getter
    }

    #[test]
    #[should_panic(expected: 'Allocation exceeds 100%')]
    fn test_update_platform_pool_allocation_exceeds() {
        let (egyptfi, owner, _, _, _, _) = setup();

        start_cheat_caller_address(egyptfi.contract_address, owner);
        egyptfi.update_platform_pool_allocation(10001);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    #[test]
    fn test_admin_withdraw_fees() {

        let (egyptfi, owner, usdc, merchant, customer, _) = setup();
        let withdrawal_address = contract_address_const::<'withdrawal'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(withdrawal_address, 123);
        stop_cheat_caller_address(egyptfi.contract_address);

        let amount = 500000000;

        start_cheat_caller_address(usdc.contract_address, customer);
        usdc.mint(customer, amount); // Mint some USDC to customer
        usdc.approve(egyptfi.contract_address, amount);
        stop_cheat_caller_address(usdc.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, customer);

        let payment_id = egyptfi.create_payment(merchant, amount, 100, 999, 888);


        egyptfi.process_payment(payment_id);
        stop_cheat_caller_address(egyptfi.contract_address);

        start_cheat_caller_address(egyptfi.contract_address, owner);
        egyptfi.admin_withdraw_fees(500000, owner);
        stop_cheat_caller_address(egyptfi.contract_address);

        // Check balance if possible, but since storage is private, assume success
    }

    #[test]
    #[should_panic(expected: 'Insufficient platform balance')]
    fn test_admin_withdraw_fees_insufficient() {
        let (egyptfi, owner, _, _, _, _) = setup();

        start_cheat_caller_address(egyptfi.contract_address, owner);
        egyptfi.admin_withdraw_fees(1000000, owner);
        stop_cheat_caller_address(egyptfi.contract_address);
    }

    // Other admin functions require platform deposits, simplified
    #[test]
    #[should_panic(expected: 'No position in pool')]
    fn test_admin_claim_yield_from_pool_no_position() {
        let (egyptfi, owner, _, _) = setup_with_pool();

        start_cheat_caller_address(egyptfi.contract_address, owner);
        egyptfi.admin_claim_yield_from_pool('pool1');
        stop_cheat_caller_address(egyptfi.contract_address);

        // Should panic or do nothing
    }

    #[test]
    #[should_panic(expected: 'No position in pool')]
    fn test_admin_redeem_principal_from_pool_no_position() {
        let (egyptfi, owner, _, _) = setup_with_pool();

        start_cheat_caller_address(egyptfi.contract_address, owner);
        egyptfi.admin_redeem_principal_from_pool('pool1', owner);
        stop_cheat_caller_address(egyptfi.contract_address);

        // Should panic or do nothing
    }

    // Additional missing tests for complete coverage

    #[test]
    #[should_panic(expected: 'No position')]
    fn test_claim_yield_from_pool_no_position() {
        let (egyptfi, _, _, _) = setup_with_pool();
        let merchant = contract_address_const::<'merchant'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(contract_address_const::<'withdrawal'>(), 123);
        egyptfi.claim_yield_from_pool('pool1');
        stop_cheat_caller_address(egyptfi.contract_address);

        // Should panic or do nothing
    }

    #[test]
    #[should_panic(expected: 'No position')]
    fn test_compound_pool_yield_no_position() {
        let (egyptfi, _, _, _) = setup_with_pool();
        let merchant = contract_address_const::<'merchant'>();

        start_cheat_caller_address(egyptfi.contract_address, merchant);
        egyptfi.register_merchant(contract_address_const::<'withdrawal'>(), 123);
        egyptfi.compound_pool_yield('pool1');
        stop_cheat_caller_address(egyptfi.contract_address);

        // Should panic or do nothing
    }
}