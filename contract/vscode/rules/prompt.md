Prompt:

  Contract 2: L2 (Starknet, Cairo 1.x)
 This is the main contract.

 It must:

 1. Implement the `on_receive` function to handle incoming bridged ETH, tBTC, or USDT from Ethereum via StarkGate.

    * Accept `depositor`, `amount`, and serialized `message` from L1.
    * Parse the message to determine which path to swap (e.g., ETH→STRK→USDT, tBTC→USDT).
 2. Use Ekubo’s swap interface:

    * Call `ICore.lock()` with `SwapData` struct inside a `swap()` function.
    * In the `locked()` callback function, deserialize SwapData:

      * Execute `core.swap()` with the right pool key.
      * Handle both positive (pay input) and negative (withdraw output) deltas.
      * Return a serialized SwapResult.
    * Support both exact-output (negative amount) and exact-input modes.
 3. Support common swap paths:

    * ETH → STRK → USDT
    * tBTC → USDT
    * STRK → USDT
    * (Future-proof to support USDT → DAI, etc.)
 4. Include reusable helpers to:

    * Serialize/deserialize messages
    * Retrieve pool keys based on token pairs
    * Withdraw funds to final recipients

replace with lib.cairo


safebox on  main 
❯ sncast \
    account create \
    --network sepolia \
    --name nummus     
command: account create
add_profile: --add-profile flag was not set. No profile added to snfoundry.toml
address: 0x056745550a90d664bf632c291b2b03e0402b635c7f63d226e2c0e0ff850b001c
estimated_fee: 4052334221807424
message: Account successfully created but it needs to be deployed. The estimated deployment fee is 0.004052334221807424 STRK. Prefund the account to cover deployment transaction fee

After prefunding the account, run:
sncast account deploy --network sepolia --name nummus

To see account creation details, visit:
account: https://sepolia.starkscan.co/contract/0x056745550a90d664bf632c291b2b03e0402b635c7f63d226e2c0e0ff850b001c
