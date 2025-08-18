// Debug script to test JWT functionality
// Run with: node debug-jwt.js

const jwt = require('jsonwebtoken');

// Test environment variables
console.log('Environment Variables Check:');
console.log('NEXT_PUBLIC_EGYPTFI_TESTNET_SECRET:', !!process.env.NEXT_PUBLIC_EGYPTFI_TESTNET_SECRET);
console.log('NEXT_PUBLIC_EGYPTFI_MAINNET_SECRET:', !!process.env.NEXT_PUBLIC_EGYPTFI_MAINNET_SECRET);

const testnetSecret = process.env.NEXT_PUBLIC_EGYPTFI_TESTNET_SECRET || 'testnet-specific-secret';
const mainnetSecret = process.env.NEXT_PUBLIC_EGYPTFI_MAINNET_SECRET || 'mainnet-specific-secret';

// Test JWT generation and verification
const testPayload = {
  merchantId: 'test-merchant-id',
  walletAddress: '0x1234567890abcdef',
  environment: 'testnet'
};

console.log('\nTesting JWT Generation and Verification:');

try {
  // Generate testnet JWT
  const testnetJWT = jwt.sign(testPayload, testnetSecret, { expiresIn: '1d' });
  console.log('Testnet JWT generated successfully');
  console.log('JWT preview:', testnetJWT.substring(0, 50) + '...');
  
  // Verify testnet JWT
  const decoded = jwt.decode(testnetJWT);
  console.log('Decoded payload:', decoded);
  
  const verified = jwt.verify(testnetJWT, testnetSecret);
  console.log('Testnet JWT verified successfully:', !!verified);
  
  // Test mainnet
  const mainnetPayload = { ...testPayload, environment: 'mainnet' };
  const mainnetJWT = jwt.sign(mainnetPayload, mainnetSecret, { expiresIn: '1d' });
  const mainnetVerified = jwt.verify(mainnetJWT, mainnetSecret);
  console.log('Mainnet JWT verified successfully:', !!mainnetVerified);
  
} catch (error) {
  console.error('JWT Error:', error.message);
}

console.log('\nIf you see errors above, check your environment variables in .env file');