pragma circom 2.0.0;

include "poseidon.circom";
include "comparators.circom";

template ZKOrderSummary(n) { // n = max number of orders
    // Private inputs
    signal input order_amounts[n];
    signal input order_ids[n];
    signal input order_timestamps[n]; // Added for time check
    signal input merchant_id;
    signal input time_period_start;
    signal input time_period_end;
    signal input num_orders;
    
    // Public inputs
    signal input total_commitment;
    signal input merchant_commitment;
    signal input time_range_hash;
    
    // Outputs
    signal output summary_hash;
    
    component order_hasher = Poseidon(n + 3);
    component time_range_hasher = Poseidon(2);
    component time_checks_start[n];
    component time_checks_end[n];
    
    signal total_sum;
    signal intermediate_sums[n+1];
    intermediate_sums[0] <== 0;
    
    // Sum all order amounts with loop; enforce num_orders
    for (var i = 0; i < n; i++) {
        // Pad beyond num_orders
        var is_active = i < num_orders ? 1 : 0;
        intermediate_sums[i+1] <== intermediate_sums[i] + order_amounts[i] * is_active;
        
        // Ensure orders within time range (only for active)
        time_checks_start[i] = GreaterEqThan(32);
        time_checks_start[i].in[0] <== order_timestamps[i];
        time_checks_start[i].in[1] <== time_period_start;
        time_checks_start[i].out * is_active === is_active; // Enforce >= start
        
        time_checks_end[i] = LessEqThan(32);
        time_checks_end[i].in[0] <== order_timestamps[i];
        time_checks_end[i].in[1] <== time_period_end;
        time_checks_end[i].out * is_active === is_active; // Enforce <= end
    }
    total_sum <== intermediate_sums[n];
    
    // Verify total matches commitment
    total_sum === total_commitment;
    
    // Constrain merchant_commitment (assume it's hash of merchant_id)
    component merch_hasher = Poseidon(1);
    merch_hasher.inputs[0] <== merchant_id;
    merch_hasher.out === merchant_commitment;
    
    // Constrain time_range_hash
    time_range_hasher.inputs[0] <== time_period_start;
    time_range_hasher.inputs[1] <== time_period_end;
    time_range_hasher.out === time_range_hash;
    
    // Generate summary hash
    order_hasher.inputs[0] <== total_sum;
    order_hasher.inputs[1] <== merchant_id;
    order_hasher.inputs[2] <== num_orders;
    for (var i = 0; i < n; i++) {
        order_hasher.inputs[i + 3] <== order_ids[i];
    }
    summary_hash <== order_hasher.out;
}

component main {public [total_commitment, merchant_commitment, time_range_hash]} = ZKOrderSummary(100);