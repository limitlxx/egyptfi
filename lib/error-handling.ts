/**
 * Standardized error handling system for ChipiPay integration
 * Provides consistent error codes, messages, and response formats
 */

import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// Error categories and codes
export enum ErrorCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  VALIDATION = 'VALIDATION',
  WALLET = 'WALLET',
  NETWORK = 'NETWORK',
  CHIPIPAY = 'CHIPIPAY',
  DATABASE = 'DATABASE',
  INTERNAL = 'INTERNAL'
}

export enum ErrorCode {
  // Authentication errors
  INVALID_API_KEY = 'INVALID_API_KEY',
  INVALID_PIN = 'INVALID_PIN',
  UNAUTHORIZED = 'UNAUTHORIZED',
  PIN_ATTEMPTS_EXCEEDED = 'PIN_ATTEMPTS_EXCEEDED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // Validation errors
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  MISSING_REQUIRED_FIELDS = 'MISSING_REQUIRED_FIELDS',
  INVALID_ADDRESS_FORMAT = 'INVALID_ADDRESS_FORMAT',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  INVALID_CONTRACT_ADDRESS = 'INVALID_CONTRACT_ADDRESS',
  
  // Wallet errors
  WALLET_CREATION_FAILED = 'WALLET_CREATION_FAILED',
  WALLET_DECRYPTION_FAILED = 'WALLET_DECRYPTION_FAILED',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  TRANSFER_FAILED = 'TRANSFER_FAILED',
  APPROVAL_FAILED = 'APPROVAL_FAILED',
  CONTRACT_CALL_FAILED = 'CONTRACT_CALL_FAILED',
  
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  
  // ChipiPay specific errors
  CHIPIPAY_API_ERROR = 'CHIPIPAY_API_ERROR',
  CHIPIPAY_AUTHENTICATION_FAILED = 'CHIPIPAY_AUTHENTICATION_FAILED',
  CHIPIPAY_SERVICE_UNAVAILABLE = 'CHIPIPAY_SERVICE_UNAVAILABLE',
  
  // Database errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  RECORD_NOT_FOUND = 'RECORD_NOT_FOUND',
  DUPLICATE_RECORD = 'DUPLICATE_RECORD',
  
  // Internal errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR'
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

// Standardized error response interface
export interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    details?: any;
    timestamp: string;
    requestId: string;
    userMessage?: string;
    retryable?: boolean;
    attemptsRemaining?: number;
  };
}

// Success response interface
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  requestId: string;
  timestamp: string;
}

// Error definition interface
interface ErrorDefinition {
  category: ErrorCategory;
  severity: ErrorSeverity;
  userMessage: string;
  retryable: boolean;
  httpStatus: number;
}

// Error definitions mapping
const ERROR_DEFINITIONS: Record<ErrorCode, ErrorDefinition> = {
  // Authentication errors
  [ErrorCode.INVALID_API_KEY]: {
    category: ErrorCategory.AUTHENTICATION,
    severity: ErrorSeverity.MEDIUM,
    userMessage: 'Invalid API key provided',
    retryable: false,
    httpStatus: 401
  },
  [ErrorCode.INVALID_PIN]: {
    category: ErrorCategory.AUTHENTICATION,
    severity: ErrorSeverity.MEDIUM,
    userMessage: 'Invalid PIN provided',
    retryable: true,
    httpStatus: 401
  },
  [ErrorCode.UNAUTHORIZED]: {
    category: ErrorCategory.AUTHENTICATION,
    severity: ErrorSeverity.MEDIUM,
    userMessage: 'Unauthorized access',
    retryable: false,
    httpStatus: 401
  },
  [ErrorCode.PIN_ATTEMPTS_EXCEEDED]: {
    category: ErrorCategory.AUTHENTICATION,
    severity: ErrorSeverity.HIGH,
    userMessage: 'Too many failed PIN attempts. Please try again later.',
    retryable: false,
    httpStatus: 429
  },
  [ErrorCode.TOKEN_EXPIRED]: {
    category: ErrorCategory.AUTHENTICATION,
    severity: ErrorSeverity.LOW,
    userMessage: 'Authentication token expired',
    retryable: true,
    httpStatus: 401
  },
  
  // Validation errors
  [ErrorCode.INVALID_PARAMETERS]: {
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.LOW,
    userMessage: 'Invalid parameters provided',
    retryable: false,
    httpStatus: 400
  },
  [ErrorCode.MISSING_REQUIRED_FIELDS]: {
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.LOW,
    userMessage: 'Required fields are missing',
    retryable: false,
    httpStatus: 400
  },
  [ErrorCode.INVALID_ADDRESS_FORMAT]: {
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.LOW,
    userMessage: 'Invalid address format',
    retryable: false,
    httpStatus: 400
  },
  [ErrorCode.INVALID_AMOUNT]: {
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.LOW,
    userMessage: 'Invalid amount specified',
    retryable: false,
    httpStatus: 400
  },
  [ErrorCode.INVALID_CONTRACT_ADDRESS]: {
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.LOW,
    userMessage: 'Invalid contract address format',
    retryable: false,
    httpStatus: 400
  },
  
  // Wallet errors
  [ErrorCode.WALLET_CREATION_FAILED]: {
    category: ErrorCategory.WALLET,
    severity: ErrorSeverity.HIGH,
    userMessage: 'Failed to create wallet. Please try again.',
    retryable: true,
    httpStatus: 500
  },
  [ErrorCode.WALLET_DECRYPTION_FAILED]: {
    category: ErrorCategory.WALLET,
    severity: ErrorSeverity.MEDIUM,
    userMessage: 'Failed to decrypt wallet',
    retryable: false,
    httpStatus: 401
  },
  [ErrorCode.INSUFFICIENT_BALANCE]: {
    category: ErrorCategory.WALLET,
    severity: ErrorSeverity.LOW,
    userMessage: 'Insufficient balance for this transaction',
    retryable: false,
    httpStatus: 400
  },
  [ErrorCode.TRANSFER_FAILED]: {
    category: ErrorCategory.WALLET,
    severity: ErrorSeverity.MEDIUM,
    userMessage: 'Transfer failed. Please try again.',
    retryable: true,
    httpStatus: 400
  },
  [ErrorCode.APPROVAL_FAILED]: {
    category: ErrorCategory.WALLET,
    severity: ErrorSeverity.MEDIUM,
    userMessage: 'Token approval failed. Please try again.',
    retryable: true,
    httpStatus: 400
  },
  [ErrorCode.CONTRACT_CALL_FAILED]: {
    category: ErrorCategory.WALLET,
    severity: ErrorSeverity.MEDIUM,
    userMessage: 'Contract call failed. Please try again.',
    retryable: true,
    httpStatus: 400
  },
  
  // Network errors
  [ErrorCode.NETWORK_ERROR]: {
    category: ErrorCategory.NETWORK,
    severity: ErrorSeverity.MEDIUM,
    userMessage: 'Network error occurred. Please try again.',
    retryable: true,
    httpStatus: 503
  },
  [ErrorCode.TIMEOUT_ERROR]: {
    category: ErrorCategory.NETWORK,
    severity: ErrorSeverity.MEDIUM,
    userMessage: 'Request timed out. Please try again.',
    retryable: true,
    httpStatus: 504
  },
  [ErrorCode.CONNECTION_FAILED]: {
    category: ErrorCategory.NETWORK,
    severity: ErrorSeverity.MEDIUM,
    userMessage: 'Connection failed. Please try again.',
    retryable: true,
    httpStatus: 503
  },
  
  // ChipiPay specific errors
  [ErrorCode.CHIPIPAY_API_ERROR]: {
    category: ErrorCategory.CHIPIPAY,
    severity: ErrorSeverity.MEDIUM,
    userMessage: 'ChipiPay service error. Please try again.',
    retryable: true,
    httpStatus: 502
  },
  [ErrorCode.CHIPIPAY_AUTHENTICATION_FAILED]: {
    category: ErrorCategory.CHIPIPAY,
    severity: ErrorSeverity.HIGH,
    userMessage: 'ChipiPay authentication failed',
    retryable: false,
    httpStatus: 401
  },
  [ErrorCode.CHIPIPAY_SERVICE_UNAVAILABLE]: {
    category: ErrorCategory.CHIPIPAY,
    severity: ErrorSeverity.HIGH,
    userMessage: 'ChipiPay service is temporarily unavailable',
    retryable: true,
    httpStatus: 503
  },
  
  // Database errors
  [ErrorCode.DATABASE_ERROR]: {
    category: ErrorCategory.DATABASE,
    severity: ErrorSeverity.HIGH,
    userMessage: 'Database error occurred',
    retryable: true,
    httpStatus: 500
  },
  [ErrorCode.RECORD_NOT_FOUND]: {
    category: ErrorCategory.DATABASE,
    severity: ErrorSeverity.LOW,
    userMessage: 'Record not found',
    retryable: false,
    httpStatus: 404
  },
  [ErrorCode.DUPLICATE_RECORD]: {
    category: ErrorCategory.DATABASE,
    severity: ErrorSeverity.LOW,
    userMessage: 'Record already exists',
    retryable: false,
    httpStatus: 409
  },
  
  // Internal errors
  [ErrorCode.INTERNAL_ERROR]: {
    category: ErrorCategory.INTERNAL,
    severity: ErrorSeverity.CRITICAL,
    userMessage: 'An internal error occurred. Please try again later.',
    retryable: true,
    httpStatus: 500
  },
  [ErrorCode.CONFIGURATION_ERROR]: {
    category: ErrorCategory.INTERNAL,
    severity: ErrorSeverity.CRITICAL,
    userMessage: 'System configuration error',
    retryable: false,
    httpStatus: 500
  }
};

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
  code: ErrorCode,
  technicalMessage?: string,
  details?: any,
  attemptsRemaining?: number
): ErrorResponse {
  const definition = ERROR_DEFINITIONS[code];
  const requestId = uuidv4();
  
  return {
    success: false,
    error: {
      code,
      message: technicalMessage || definition.userMessage,
      category: definition.category,
      severity: definition.severity,
      details,
      timestamp: new Date().toISOString(),
      requestId,
      userMessage: definition.userMessage,
      retryable: definition.retryable,
      attemptsRemaining
    }
  };
}

/**
 * Creates a standardized success response
 */
export function createSuccessResponse<T>(data: T): SuccessResponse<T> {
  return {
    success: true,
    data,
    requestId: uuidv4(),
    timestamp: new Date().toISOString()
  };
}

/**
 * Creates a NextResponse with standardized error format
 */
export function createErrorNextResponse(
  code: ErrorCode,
  technicalMessage?: string,
  details?: any,
  attemptsRemaining?: number
): NextResponse {
  const errorResponse = createErrorResponse(code, technicalMessage, details, attemptsRemaining);
  const definition = ERROR_DEFINITIONS[code];
  
  return NextResponse.json(errorResponse, { status: definition.httpStatus });
}

/**
 * Creates a NextResponse with standardized success format
 */
export function createSuccessNextResponse<T>(data: T): NextResponse {
  const successResponse = createSuccessResponse(data);
  return NextResponse.json(successResponse);
}

/**
 * Error handler class for consistent error processing
 */
export class ErrorHandler {
  /**
   * Handles and logs errors, returns appropriate response
   */
  static handleError(
    error: any,
    context: string,
    fallbackCode: ErrorCode = ErrorCode.INTERNAL_ERROR
  ): NextResponse {
    const requestId = uuidv4();
    
    // Log the error with context
    console.error(`[${context}] Error occurred:`, {
      requestId,
      error: error.message || error,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    // Determine error code based on error type
    let errorCode = fallbackCode;
    let details: any = undefined;
    
    if (error.code && Object.values(ErrorCode).includes(error.code)) {
      errorCode = error.code;
    } else if (error.message) {
      // Try to map common error messages to codes
      if (error.message.includes('timeout')) {
        errorCode = ErrorCode.TIMEOUT_ERROR;
      } else if (error.message.includes('network') || error.message.includes('connection')) {
        errorCode = ErrorCode.NETWORK_ERROR;
      } else if (error.message.includes('database') || error.message.includes('query')) {
        errorCode = ErrorCode.DATABASE_ERROR;
      } else if (error.message.includes('chipipay') || error.message.includes('ChipiPay')) {
        errorCode = ErrorCode.CHIPIPAY_API_ERROR;
      }
    }
    
    // Include error details for debugging (but not sensitive information)
    if (process.env.NODE_ENV === 'development') {
      details = {
        originalMessage: error.message,
        context
      };
    }
    
    return createErrorNextResponse(errorCode, undefined, details);
  }
  
  /**
   * Validates required fields and returns error response if validation fails
   */
  static validateRequiredFields(
    body: any,
    requiredFields: string[]
  ): NextResponse | null {
    const missingFields = requiredFields.filter(field => !body[field]);
    
    if (missingFields.length > 0) {
      return createErrorNextResponse(
        ErrorCode.MISSING_REQUIRED_FIELDS,
        `Missing required fields: ${missingFields.join(', ')}`,
        { missingFields }
      );
    }
    
    return null;
  }
  
  /**
   * Validates Starknet address format
   */
  static validateStarknetAddress(address: string, fieldName: string = 'address'): NextResponse | null {
    if (!/^0x[0-9a-fA-F]{63,64}$/.test(address)) {
      return createErrorNextResponse(
        ErrorCode.INVALID_ADDRESS_FORMAT,
        `Invalid ${fieldName} format`,
        { field: fieldName, value: address }
      );
    }
    
    return null;
  }
  
  /**
   * Validates amount format
   */
  static validateAmount(amount: string): NextResponse | null {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return createErrorNextResponse(
        ErrorCode.INVALID_AMOUNT,
        'Amount must be a positive number',
        { value: amount }
      );
    }
    
    return null;
  }
}