// lib/wallet-crypto.ts
import crypto from 'crypto';
import pool from './db';

export interface WalletDecryptionResult {
  success: boolean;
  privateKey?: string;
  error?: string;
}

export interface PinValidationResult {
  success: boolean;
  privateKey?: string;
  error?: string;
  attemptsRemaining?: number;
}

// Failed attempt tracking (in production, use Redis or similar)
const failedAttempts = new Map<string, { count: number; lockoutUntil?: number }>();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

export class WalletCrypto {
  private static readonly ALGORITHM = 'aes-256-cbc';
  private static readonly KEY_LENGTH = 32;
  private static readonly IV_LENGTH = 16;
  private static readonly SALT_LENGTH = 32;

  /**
   * Generate a salt for encryption
   */
  private static generateSalt(): Buffer {
    return crypto.randomBytes(this.SALT_LENGTH);
  }

  /**
   * Derive encryption key from PIN and salt
   */
  private static deriveKey(pin: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(pin, salt, 100000, this.KEY_LENGTH, 'sha256');
  }

  /**
   * Encrypt private key using PIN
   */
  static encryptPrivateKey(privateKey: string, pin: string): string {
    try {
      const salt = this.generateSalt();
      const key = this.deriveKey(pin, salt);
      const iv = crypto.randomBytes(this.IV_LENGTH);
      
      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
      
      let encrypted = cipher.update(privateKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Combine salt + iv + encrypted data
      const combined = Buffer.concat([
        salt,
        iv,
        Buffer.from(encrypted, 'hex')
      ]);
      
      return combined.toString('base64');
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt private key');
    }
  }

  /**
   * Decrypt private key using PIN
   */
  static decryptPrivateKey(encryptedData: string, pin: string): WalletDecryptionResult {
    try {
      const combined = Buffer.from(encryptedData, 'base64');
      
      // Extract components
      const salt = combined.subarray(0, this.SALT_LENGTH);
      const iv = combined.subarray(this.SALT_LENGTH, this.SALT_LENGTH + this.IV_LENGTH);
      const encrypted = combined.subarray(this.SALT_LENGTH + this.IV_LENGTH);
      
      const key = this.deriveKey(pin, salt);
      
      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
      
      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');
      
      return {
        success: true,
        privateKey: decrypted
      };
    } catch (error) {
      console.error('Decryption error:', error);
      return {
        success: false,
        error: 'Invalid PIN or corrupted data'
      };
    }
  }

  /**
   * Check if merchant is locked out due to failed attempts
   */
  private static isLockedOut(merchantId: string): boolean {
    const attempts = failedAttempts.get(merchantId);
    if (!attempts) return false;
    
    if (attempts.lockoutUntil && Date.now() < attempts.lockoutUntil) {
      return true;
    }
    
    // Clear expired lockout
    if (attempts.lockoutUntil && Date.now() >= attempts.lockoutUntil) {
      failedAttempts.delete(merchantId);
    }
    
    return false;
  }

  /**
   * Record failed PIN attempt
   */
  private static recordFailedAttempt(merchantId: string): number {
    const current = failedAttempts.get(merchantId) || { count: 0 };
    current.count++;
    
    if (current.count >= MAX_FAILED_ATTEMPTS) {
      current.lockoutUntil = Date.now() + LOCKOUT_DURATION;
    }
    
    failedAttempts.set(merchantId, current);
    return MAX_FAILED_ATTEMPTS - current.count;
  }

  /**
   * Clear failed attempts on successful validation
   */
  private static clearFailedAttempts(merchantId: string): void {
    failedAttempts.delete(merchantId);
  }

  /**
   * Validate PIN by attempting to decrypt the private key
   */
  static async validatePinAndDecryptWallet(
    merchantId: string, 
    pin: string
  ): Promise<PinValidationResult> {
    try {
      // Check if merchant is locked out
      if (this.isLockedOut(merchantId)) {
        const attempts = failedAttempts.get(merchantId);
        const lockoutEnd = attempts?.lockoutUntil || 0;
        const remainingTime = Math.ceil((lockoutEnd - Date.now()) / 1000 / 60);
        
        return {
          success: false,
          error: `Account locked due to too many failed attempts. Try again in ${remainingTime} minutes.`
        };
      }

      // Validate PIN format (4-8 digits)
      if (!/^[0-9]{4,8}$/.test(pin)) {
        this.recordFailedAttempt(merchantId);
        return {
          success: false,
          error: 'PIN must be 4-8 digits',
          attemptsRemaining: MAX_FAILED_ATTEMPTS - (failedAttempts.get(merchantId)?.count || 0)
        };
      }

      // Get encrypted private key from database
      const client = await pool.connect();
      try {
        const result = await client.query(
          'SELECT wallet_encrypted_private_key FROM merchants WHERE id = $1',
          [merchantId]
        );

        if (result.rows.length === 0) {
          return {
            success: false,
            error: 'Merchant not found'
          };
        }

        const encryptedPrivateKey = result.rows[0].wallet_encrypted_private_key;
        if (!encryptedPrivateKey) {
          return {
            success: false,
            error: 'No wallet found for merchant'
          };
        }

        // Attempt to decrypt the private key
        const decryptionResult = this.decryptPrivateKey(encryptedPrivateKey, pin);
        
        if (decryptionResult.success) {
          // Clear failed attempts on success
          this.clearFailedAttempts(merchantId);
          
          return {
            success: true,
            privateKey: decryptionResult.privateKey
          };
        } else {
          // Record failed attempt
          const attemptsRemaining = this.recordFailedAttempt(merchantId);
          
          return {
            success: false,
            error: 'Invalid PIN',
            attemptsRemaining: Math.max(0, attemptsRemaining)
          };
        }

      } finally {
        client.release();
      }
    } catch (error) {
      console.error('PIN validation error:', error);
      return {
        success: false,
        error: 'PIN validation failed'
      };
    }
  }

  /**
   * Get remaining attempts for a merchant
   */
  static getRemainingAttempts(merchantId: string): number {
    const attempts = failedAttempts.get(merchantId);
    if (!attempts) return MAX_FAILED_ATTEMPTS;
    
    if (this.isLockedOut(merchantId)) return 0;
    
    return Math.max(0, MAX_FAILED_ATTEMPTS - attempts.count);
  }

  /**
   * Check if merchant is currently locked out
   */
  static isAccountLocked(merchantId: string): boolean {
    return this.isLockedOut(merchantId);
  }
}