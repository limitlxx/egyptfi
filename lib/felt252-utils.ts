/**
 * Utility functions for converting strings to felt252 format for Cairo contracts
 * Save this file as: lib/felt252-utils.ts
 */

/**
 * Converts a string to felt252 format (31 bytes max)
 * Cairo felt252 can hold up to 31 ASCII characters
 * @param str - Input string to convert
 * @returns felt252 compatible string or throws error if too long
 */
export function stringToFelt252(str: string): string {
  if (!str) return "0x0";
  
  // Cairo felt252 can only hold 31 bytes (31 ASCII characters)
  if (str.length > 31) {
    throw new Error(`String too long for felt252: ${str.length} characters (max 31)`);
  }
  
  // Convert string to hex
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  
  // Convert bytes to hex string
  const hex = Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
  
  return `0x${hex}`;
}

/**
 * Convert a Cairo felt252 bigint to a safe JS integer (or string if too large).
 */
export function feltToInt(value?: bigint): number | string {
  if (value === undefined) return 0; // default when undefined

  // JavaScript's safe integer limit
  const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

  if (value > MAX_SAFE) {
    // Return as string to avoid losing precision
    return value.toString();
  }

  return Number(value);
}


/**
 * Converts a felt252 hex string back to a readable string
 * @param felt252 - Hex string in felt252 format
 * @returns Original string
 */
export function felt252ToString(felt252: string): string {
  if (!felt252 || felt252 === "0x0") return "";
  
  // Remove 0x prefix
  const hex = felt252.startsWith("0x") ? felt252.slice(2) : felt252;
  
  // Convert hex to bytes
  const bytes = new Uint8Array(
    hex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
  );
  
  // Decode bytes to string
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

/**
 * Truncates a string to fit in felt252 (31 characters) and converts it
 * Useful for long business names or emails
 * @param str - Input string
 * @param suffix - Optional suffix to add when truncating (default: "...")
 * @returns felt252 compatible string
 */
export function truncateToFelt252(str: string, suffix: string = "..."): string {
  if (!str) return "0x0";
  
  if (str.length <= 31) {
    return stringToFelt252(str);
  }
  
  // Calculate how much space we have for the original string
  const maxLength = 31 - suffix.length;
  const truncated = str.slice(0, maxLength) + suffix;
  
  return stringToFelt252(truncated);
}

/**
 * Splits a long string into multiple felt252 chunks
 * Useful for very long descriptions or data
 * @param str - Input string
 * @returns Array of felt252 strings
 */
export function stringToFelt252Array(str: string): string[] {
  if (!str) return ["0x0"];
  
  const chunks: string[] = [];
  
  for (let i = 0; i < str.length; i += 31) {
    const chunk = str.slice(i, i + 31);
    chunks.push(stringToFelt252(chunk));
  }
  
  return chunks;
}

/**
 * Converts an email to felt252, handling common cases
 * For very long emails, it truncates intelligently
 * @param email - Email address
 * @returns felt252 compatible string
 */
export function emailToFelt252(email: string): string {
  if (!email) return "0x0";
  
  if (email.length <= 31) {
    return stringToFelt252(email);
  }
  
  // For long emails, try to keep the domain intact
  const [localPart, domain] = email.split('@');
  
  if (domain && domain.length < 20) {
    // Try to preserve domain
    const maxLocalLength = 31 - domain.length - 1 - 3; // -1 for @, -3 for ...
    if (maxLocalLength > 0) {
      const truncatedLocal = localPart.slice(0, maxLocalLength);
      return stringToFelt252(`${truncatedLocal}...@${domain}`);
    }
  }
  
  // Fallback to simple truncation
  return truncateToFelt252(email);
}

/**
 * Validates if a string can fit in felt252 without conversion
 * @param str - Input string
 * @returns boolean indicating if string fits
 */
export function canFitInFelt252(str: string): boolean {
  return str.length <= 31;
}

/**
 * Creates a hash-based felt252 for very long strings
 * Uses a simple hash to create a consistent felt252 representation
 * @param str - Input string
 * @returns felt252 hash
 */
export function hashToFelt252(str: string): string {
  if (!str) return "0x0";
  
  // Simple hash function (you might want to use a better one in production)
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to positive number and then to hex
  const positiveHash = Math.abs(hash);
  return `0x${positiveHash.toString(16)}`;
}

/**
 * Advanced email handling for felt252
 * Creates a shortened version that's still meaningful
 * @param email - Email address
 * @returns felt252 string with smart truncation
 */
export function smartEmailToFelt252(email: string): string {
  if (!email) return "0x0";
  
  if (email.length <= 31) {
    return stringToFelt252(email);
  }
  
  // Extract domain
  const atIndex = email.lastIndexOf('@');
  if (atIndex === -1) {
    return truncateToFelt252(email);
  }
  
  const localPart = email.substring(0, atIndex);
  const domain = email.substring(atIndex); // includes @
  
  // If domain is too long, just truncate normally
  if (domain.length > 20) {
    return truncateToFelt252(email);
  }
  
  // Try to keep some of the local part + full domain
  const availableForLocal = 31 - domain.length;
  if (availableForLocal > 3) {
    const truncatedLocal = localPart.substring(0, availableForLocal - 3) + "...";
    return stringToFelt252(truncatedLocal + domain);
  }
  
  // Fallback
  return truncateToFelt252(email);
}

// Example usage and test functions
export const felt252Utils = {
  stringToFelt252,
  felt252ToString,
  truncateToFelt252,
  stringToFelt252Array,
  emailToFelt252,
  smartEmailToFelt252,
  canFitInFelt252,
  hashToFelt252,
  feltToInt,
  
  // Test function to verify conversion works correctly
  test: (str: string) => {
    try {
      const felt = stringToFelt252(str);
      const converted = felt252ToString(felt);
      console.log({
        original: str,
        felt252: felt,
        converted: converted,
        matches: str === converted
      });
      return str === converted;
    } catch (error) {
      console.error("Conversion test failed:", error);
      return false;
    }
  },

  // Test email conversion
  testEmail: (email: string) => {
    try {
      const felt = emailToFelt252(email);
      const smart = smartEmailToFelt252(email);
      const converted = felt252ToString(felt);
      const smartConverted = felt252ToString(smart);
      
      console.log({
        original: email,
        regularFelt: felt,
        regularConverted: converted,
        smartFelt: smart,
        smartConverted: smartConverted
      });
      
      return { felt, smart, converted, smartConverted };
    } catch (error) {
      console.error("Email conversion test failed:", error);
      return null;
    }
  }
};
 