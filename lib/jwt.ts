import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const EGYPTFI_SECRET = process.env.EGYPTFI_SECRET || 'your-egyptfi-secret';

export interface JWTPayload {
  merchantId: string;
  walletAddress: string;
  egyptfiSecret: string;
  createdDate: string;
  environment: 'testnet' | 'mainnet';
}

export function generateJWT(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyJWT(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

export function generateApiKeys(merchantId: string, environment: 'testnet' | 'mainnet') {
  const prefix = environment === 'testnet' ? 'test_' : 'live_';
  const publicKey = `pk_${prefix}${crypto.randomBytes(16).toString('hex')}`;
  const secretKey = `sk_${prefix}${crypto.randomBytes(16).toString('hex')}`;
  
  return { publicKey, secretKey };
}

export function hashSecretKey(secretKey: string): string {
  return crypto.createHash('sha256').update(secretKey + JWT_SECRET).digest('hex');
}