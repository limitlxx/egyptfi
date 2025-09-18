/**
 * Basic error handling for testing
 */

export enum ErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CHIPIPAY_API_ERROR = 'CHIPIPAY_API_ERROR'
}

export function createErrorResponse(code: ErrorCode, message: string, details?: any) {
  return {
    error: {
      code,
      message,
      details
    }
  };
}