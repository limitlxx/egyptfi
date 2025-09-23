// Test script to verify wallet data is being saved correctly
const testWalletResponse = {
  txHash: "0x748de8bf64b90540324b63e52e98f9ec12c1f7af6414228ed95714dd86237da",
  walletPublicKey: "0x5ead44cc23c0e5201be6d4c893b1a8289f350d4ccb42dea4111eed5a0efd483",
  wallet: {
    publicKey: "0x5ead44cc23c0e5201be6d4c893b1a8289f350d4ccb42dea4111eed5a0efd483",
    encryptedPrivateKey: "U2FsdGVkX1+2heDdOTQrzRcwL/+A0/hwUR9o+iz9knFj3/lr3yKWmoc2Tn6rNRHIhBmDWsN4cc7KPMiC1jtQ4M/SOonKF3SbXVbeda7BGFmkPJmVijziY+NBTlfxi9nn"
  }
};

const testPayload = {
  walletResponse: testWalletResponse,
  merchantId: "test-merchant-123",
  encryptedPin: "encrypted-pin-example",
  contractHash: "0x748de8bf64b90540324b63e52e98f9ec12c1f7af6414228ed95714dd86237da",
  contractStatus: true
};

console.log("Test payload for wallet update:");
console.log(JSON.stringify(testPayload, null, 2));

console.log("\nExpected database fields to be updated:");
console.log("- wallet_address:", testWalletResponse.walletPublicKey);
console.log("- wallet_public_key:", testWalletResponse.walletPublicKey);
console.log("- chipipay_external_user_id:", testPayload.merchantId);
console.log("- contract_transaction_hash:", testPayload.contractHash);
console.log("- contract_registered:", testPayload.contractStatus);
console.log("- pin_code:", testPayload.encryptedPin);
console.log("- wallet_encrypted_private_key:", testWalletResponse.wallet.encryptedPrivateKey);
console.log("- wallet_created_at:", "current timestamp");

console.log("\nTo test this API endpoint, make a POST request to:");
console.log("POST /api/merchants/update-wallet");
console.log("Headers:");
console.log("- Content-Type: application/json");
console.log("- Authorization: Bearer <jwt-token>");
console.log("- x-api-key: <your-api-key>");
console.log("- x-environment: <environment>");
console.log("Body:", JSON.stringify(testPayload, null, 2));