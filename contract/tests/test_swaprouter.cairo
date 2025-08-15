use starknet::{ContractAddress, contract_address_const};
use core::array::ArrayTrait;
use core::span::SpanTrait;
use safebox::SwapRouter;

#[test]
fn test_on_receive_and_swap() {
    // Mock addresses
    let ekubo_core = contract_address_const::<0x111>();
    let eth = contract_address_const::<0x222>();
    let strk = contract_address_const::<0x333>();
    let tbtc = contract_address_const::<0x444>();
    let usdt = contract_address_const::<0x555>();
    let dai = contract_address_const::<0x666>();
    let bridge_operator = contract_address_const::<0x777>();
    let recipient = contract_address_const::<0x888>();

    // Deploy contract
    let mut contract = SwapRouter::deploy(
        ekubo_core,
        eth,
        strk,
        tbtc,
        usdt,
        dai,
        bridge_operator
    );

    // Simulate a swap message: [swap_type, output_token, min_output, recipient]
    let swap_type = 0; // e.g. direct swap
    let output_token = usdt.into();
    let min_output = 1000;
    let message = array![swap_type.into(), output_token, min_output.into(), recipient.into()];
    let message_span = message.span();

    // Simulate bridge call
    let depositor = contract_address_const::<0x999>();
    let amount = 5000;
    // Set caller to bridge_operator
    starknet::testing::set_caller_address(bridge_operator);
    contract.on_receive(depositor, amount, message_span);

    // Check that SwapExecuted event was emitted
    let events = contract.get_emitted_events();
    let mut found = false;
    for event in events.iter() {
        match event {
            safebox::SwapRouter::Event::SwapExecuted(ev) => {
                assert(ev.recipient == recipient, 'Recipient mismatch');
                assert(ev.token_in == eth, 'Input token mismatch');
                assert(ev.token_out == usdt, 'Output token mismatch');
                found = true;
            },
            _ => {}
        }
    }
    assert(found, 'SwapExecuted event not found');
}
