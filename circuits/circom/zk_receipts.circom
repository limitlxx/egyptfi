pragma circom 2.0.0;

include "poseidon.circom";
include "eddsaposeidon.circom";
include "comparators.circom";
// Include Merkle if needed

template ZKReceiptGeneration() {
    // Private inputs
    signal input payment_amount;
    signal input merchant_id;
    signal input customer_id;
    signal input timestamp;
    signal input payment_reference;
    signal input merchant_signature_R8x;
    signal input merchant_signature_R8y;
    signal input merchant_signature_S;
    signal input merchant_pubkey_x; // Add if private; or make public
    signal input merchant_pubkey_y;
    
    // Public inputs
    signal input payment_hash; // Public commitment
    signal input merkle_root; // Verified payments root (unused here; add proof if needed)
    signal input range_min; // For amount range proofs
    signal input range_max;
    
    // Outputs
    signal output receipt_commitment;
    
    component hasher = Poseidon(5);
    component amount_check_min = LessThan(64);
    component amount_check_max = LessThan(64);
    component signature_check = EdDSAPoseidonVerifier();
    component payment_hasher = Poseidon(4);
    
    // Generate receipt commitment
    hasher.inputs[0] <== payment_amount;
    hasher.inputs[1] <== merchant_id;
    hasher.inputs[2] <== customer_id;
    hasher.inputs[3] <== timestamp;
    hasher.inputs[4] <== payment_reference;
    receipt_commitment <== hasher.out;
    
    // Verify amount is within range
    amount_check_min.in[0] <== range_min;
    amount_check_min.in[1] <== payment_amount + 1; // min <= amount
    amount_check_min.out === 1;
    
    amount_check_max.in[0] <== payment_amount;
    amount_check_max.in[1] <== range_max + 1; // amount <= max
    amount_check_max.out === 1;
    
    // Verify payment hash matches
    payment_hasher.inputs[0] <== payment_amount;
    payment_hasher.inputs[1] <== merchant_id;
    payment_hasher.inputs[2] <== customer_id;
    payment_hasher.inputs[3] <== timestamp;
    payment_hasher.out === payment_hash;
    
    // Verify merchant signature over payment_hash
    signature_check.enabled <== 1;
    signature_check.Ax <== merchant_pubkey_x;
    signature_check.Ay <== merchant_pubkey_y;
    signature_check.S <== merchant_signature_S;
    signature_check.R8x <== merchant_signature_R8x;
    signature_check.R8y <== merchant_signature_R8y;
    signature_check.M <== payment_hash;
    
    // Add Merkle inclusion if merkle_root is for payment_hash inclusion
    // e.g., component merkle_verifier = ...; merkle_verifier.leaf <== payment_hash; etc.
}

component main {public [payment_hash, merkle_root, range_min, range_max]} = ZKReceiptGeneration();