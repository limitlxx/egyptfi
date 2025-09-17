use starknet::{ContractAddress, contract_address_const};

#[starknet::interface]
trait ISwapRouter<TContractState> {
    fn on_receive(
        ref self: TContractState,
        depositor: ContractAddress,
        amount: u256,
        message: Span<felt252>
    );
    fn swap(ref self: TContractState, swap_data: SwapData) -> SwapResult;
    fn locked(ref self: TContractState, data_len: u32, data: felt252) -> felt252;
}

#[starknet::interface]
trait ICore<TContractState> {
    fn lock(ref self: TContractState, data_len: u32, data: felt252) -> felt252;
    fn swap(
        ref self: TContractState,
        pool_key: PoolKey,
        params: SwapParameters
    ) -> (i129, i129, u256, u256);
    fn mint_position(ref self: TContractState, pool_key: PoolKey, bounds: Bounds, liquidity_delta: u128);
    fn burn_position(ref self: TContractState, pool_key: PoolKey, bounds: Bounds, liquidity_delta: u128);
}

#[starknet::interface]
trait IERC20<TContractState> {
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(ref self: TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256) -> bool;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
}

#[derive(Drop, Copy, Serde)]
struct PoolKey {
    token0: ContractAddress,
    token1: ContractAddress,
    fee: u128,
    tick_spacing: u128,
    extension: ContractAddress,
}

#[derive(Drop, Copy, Serde)]
struct SwapParameters {
    amount: i129,
    is_token1: bool,
    sqrt_ratio_limit: u256,
}

#[derive(Drop, Copy, Serde)]
struct Bounds {
    lower: i129,
    upper: i129,
}

#[derive(Drop, Copy, Serde)]
struct SwapData {
    pool_key: PoolKey,
    amount: i129,
    token_address: ContractAddress,
    recipient: ContractAddress,
    min_output: u256,
}

#[derive(Drop, Copy, Serde)]
struct SwapResult {
    amount_in: u256,
    amount_out: u256,
    pool_key: PoolKey,
}

#[starknet::contract]
mod SwapRouter {
    use super::{ISwapRouter, ICore, IERC20, PoolKey, SwapParameters, SwapData, SwapResult};
    use starknet::{
        ContractAddress, get_caller_address, get_contract_address, contract_address_const,
        storage::{Map, StoragePointerReadAccess, StoragePointerWriteAccess}
    };
    use core::serde::Serde;

    #[storage]
    struct Storage {
        ekubo_core: ContractAddress,
        // Token addresses
        eth_address: ContractAddress,
        strk_address: ContractAddress,
        tbtc_address: ContractAddress,
        usdt_address: ContractAddress,
        dai_address: ContractAddress,
        // Pool keys for common pairs
        pool_keys: Map<(ContractAddress, ContractAddress), PoolKey>,
        // Bridge operator (L1 bridge)
        bridge_operator: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        TokensReceived: TokensReceived,
        SwapExecuted: SwapExecuted,
    }

    #[derive(Drop, starknet::Event)]
    struct TokensReceived {
        #[key]
        depositor: ContractAddress,
        token: ContractAddress,
        amount: u256,
        message_len: u32,
    }

    #[derive(Drop, starknet::Event)]
    struct SwapExecuted {
        #[key]
        recipient: ContractAddress,
        token_in: ContractAddress,
        token_out: ContractAddress,
        amount_in: u256,
        amount_out: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        ekubo_core: ContractAddress,
        eth_address: ContractAddress,
        strk_address: ContractAddress,
        tbtc_address: ContractAddress,
        usdt_address: ContractAddress,
        dai_address: ContractAddress,
        bridge_operator: ContractAddress,
    ) {
        self.ekubo_core.write(ekubo_core);
        self.eth_address.write(eth_address);
        self.strk_address.write(strk_address);
        self.tbtc_address.write(tbtc_address);
        self.usdt_address.write(usdt_address);
        self.dai_address.write(dai_address);
        self.bridge_operator.write(bridge_operator);

        // Initialize common pool keys
        self._initialize_pool_keys();
    }

    #[abi(embed_v0)]
    impl SwapRouterImpl of ISwapRouter<ContractState> {
        fn on_receive(
            ref self: ContractState,
            depositor: ContractAddress,
            amount: u256,
            message: Span<felt252>
        ) {
            // Only bridge operator can call this
            assert(get_caller_address() == self.bridge_operator.read(), 'Unauthorized');

            self.emit(TokensReceived {
                depositor,
                token: contract_address_const::<0>(), // Will be determined from context
                amount,
                message_len: message.len(),
            });

            if message.len() > 0 {
                // Parse message to determine swap path
                let swap_type = *message.at(0);
                let output_token = contract_address_const::<{*message.at(1)}>();
                let min_output = (*message.at(2)).into();
                let recipient = contract_address_const::<{*message.at(3)}>();

                // Determine input token based on caller/context
                let input_token = self._determine_input_token();
                
                // Create swap data
                let swap_data = SwapData {
                    pool_key: self._get_pool_key(input_token, output_token),
                    amount: amount.try_into().unwrap(), // Positive for exact input
                    token_address: input_token,
                    recipient,
                    min_output,
                };

                // Execute swap
                self.swap(swap_data);
            }
        }

        fn swap(ref self: ContractState, swap_data: SwapData) -> SwapResult {
            let core = ICore::<ContractState>::from_address(self.ekubo_core.read());
            
            // Serialize swap data for the lock call
            let mut serialized_data = ArrayTrait::<felt252>::new();
            swap_data.serialize(ref serialized_data);
            
            // Call lock with serialized data
            let result_data = core.lock(serialized_data.len(), *serialized_data.at(0));
            
            // Deserialize result
            let mut result_span = array![result_data].span();
            SwapResult::deserialize(ref result_span).unwrap()
        }

        fn locked(ref self: ContractState, data_len: u32, data: felt252) -> felt252 {
            // Deserialize swap data
            let mut data_span = array![data].span();
            let swap_data = SwapData::deserialize(ref data_span).unwrap();
            
            let core = ICore::<ContractState>::from_address(self.ekubo_core.read());
            
            // Determine swap direction (token0 vs token1)
            let is_token1 = swap_data.token_address == swap_data.pool_key.token1;
            
            // Execute the swap
            let swap_params = SwapParameters {
                amount: swap_data.amount,
                is_token1,
                sqrt_ratio_limit: if is_token1 { 4295128740 } else { 1461446703485210103287273052203988822378723970341 }, // Min/max sqrt ratios
            };

            let (amount0_delta, amount1_delta, _, _) = core.swap(swap_data.pool_key, swap_params);
            
            // Handle deltas
            let (amount_in, amount_out) = if is_token1 {
                // Token1 input, token0 output
                let amount_in = if amount1_delta > 0 { amount1_delta.into() } else { 0 };
                let amount_out = if amount0_delta < 0 { (-amount0_delta).into() } else { 0 };
                (amount_in, amount_out)
            } else {
                // Token0 input, token1 output
                let amount_in = if amount0_delta > 0 { amount0_delta.into() } else { 0 };
                let amount_out = if amount1_delta < 0 { (-amount1_delta).into() } else { 0 };
                (amount_in, amount_out)
            };

            // Check minimum output
            assert(amount_out >= swap_data.min_output, 'Insufficient output amount');

            // Transfer output tokens to recipient
            let output_token = if is_token1 { swap_data.pool_key.token0 } else { swap_data.pool_key.token1 };
            let token_contract = IERC20::<ContractState>::from_address(output_token);
            token_contract.transfer(swap_data.recipient, amount_out);

            self.emit(SwapExecuted {
                recipient: swap_data.recipient,
                token_in: swap_data.token_address,
                token_out: output_token,
                amount_in,
                amount_out,
            });

            // Serialize and return result
            let result = SwapResult {
                amount_in,
                amount_out,
                pool_key: swap_data.pool_key,
            };
            
            let mut serialized_result = ArrayTrait::<felt252>::new();
            result.serialize(ref serialized_result);
            *serialized_result.at(0)
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _initialize_pool_keys(ref self: ContractState) {
            let eth = self.eth_address.read();
            let strk = self.strk_address.read();
            let tbtc = self.tbtc_address.read();
            let usdt = self.usdt_address.read();
            let dai = self.dai_address.read();

            // ETH/STRK pool (0.3% fee)
            self.pool_keys.write(
                (eth, strk),
                PoolKey {
                    token0: eth,
                    token1: strk,
                    fee: 3000, // 0.3%
                    tick_spacing: 60,
                    extension: contract_address_const::<0>(),
                }
            );

            // STRK/USDT pool (0.3% fee)  
            self.pool_keys.write(
                (strk, usdt),
                PoolKey {
                    token0: strk,
                    token1: usdt,
                    fee: 3000,
                    tick_spacing: 60,
                    extension: contract_address_const::<0>(),
                }
            );

            // tBTC/USDT pool (0.3% fee)
            self.pool_keys.write(
                (tbtc, usdt),
                PoolKey {
                    token0: tbtc,
                    token1: usdt,
                    fee: 3000,
                    tick_spacing: 60,
                    extension: contract_address_const::<0>(),
                }
            );

            // USDT/DAI pool (0.05% fee)
            self.pool_keys.write(
                (usdt, dai),
                PoolKey {
                    token0: usdt,
                    token1: dai,
                    fee: 500, // 0.05%
                    tick_spacing: 10,
                    extension: contract_address_const::<0>(),
                }
            );
        }

        fn _get_pool_key(self: @ContractState, token0: ContractAddress, token1: ContractAddress) -> PoolKey {
            let key = if token0.into() < token1.into() { (token0, token1) } else { (token1, token0) };
            self.pool_keys.read(key)
        }

        fn _determine_input_token(self: @ContractState) -> ContractAddress {
            // This would typically be determined from the bridge context
            // For now, return ETH as default
            self.eth_address.read()
        }
    }
}