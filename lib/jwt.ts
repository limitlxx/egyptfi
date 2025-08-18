// lib/jwt.ts
import jwt from 'jsonwebtoken'; 
import crypto, { randomBytes } from 'crypto';

export interface JWTPayload {
  merchantId: string;
  walletAddress: string;
  environment: 'testnet' | 'mainnet';
  iat?: number;
  exp?: number;
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export function generateApiKeys(merchantId: string, environment: 'testnet' | 'mainnet') {
  const prefix = environment === 'testnet' ? 'pk_test_' : 'pk_live_';
  const publicKey = `${prefix}${randomBytes(16).toString('hex')}`;
  const secretKey = randomBytes(32).toString('hex');
  return { publicKey, secretKey };
}

export function hashSecretKey(secretKey: string): string {
  return crypto.createHash('sha256').update(secretKey + JWT_SECRET).digest('hex');
}

export function generateJWT(payload: JWTPayload): string {
  const secret = payload.environment === 'testnet'
    ? process.env.NEXT_PUBLIC_EGYPTFI_TESTNET_SECRET
    : process.env.EGYPTFI_MAINNET_SECRET;

  if (!secret) {
    throw new Error(`No JWT secret found for ${payload.environment}`);
  }

  return jwt.sign(payload, secret, { expiresIn: '1d' });
}

export function verifyJWT(token: string): JWTPayload | null {
  if (!token) {
    console.error('JWT verification error: Token is empty or undefined');
    return null;
  }

  // Check if environment secrets are available
  const testnetSecret = process.env.NEXT_PUBLIC_EGYPTFI_TESTNET_SECRET;
  const mainnetSecret = process.env.NEXT_PUBLIC_EGYPTFI_MAINNET_SECRET;
  
  if (!testnetSecret || !mainnetSecret) {
    console.error('JWT verification error: Environment secrets not configured');
    return null;
  }

  try {
    // First, try to decode the token without verification to check the environment
    const decoded = jwt.decode(token) as JWTPayload;
    if (!decoded || !decoded.environment) {
      console.error('JWT verification error: Invalid token structure', { decoded });
      return null;
    }

    // Use the appropriate secret based on the token's environment
    const secret = decoded.environment === 'testnet' ? testnetSecret : mainnetSecret;
    
    console.log(`Attempting to verify ${decoded.environment} JWT with secret available:`, !!secret);
    
    // Verify the token with the correct secret
    const payload = jwt.verify(token, secret) as JWTPayload;
    console.log(`${decoded.environment} JWT verification successful for merchant:`, payload.merchantId);
    
    return payload;
  } catch (err) {
    console.error('JWT verification error:', {
      error: err instanceof Error ? err.message : err,
      tokenPreview: token.substring(0, 20) + '...',
      secretsAvailable: { testnet: !!testnetSecret, mainnet: !!mainnetSecret }
    });
    return null;
  }
}