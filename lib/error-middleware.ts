/**
 * Error handling middleware for API endpoints
 * Provides consistent error handling across all routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { ErrorHandler, ErrorCode, createErrorNextResponse } from './error-handling';

/**
 * Higher-order function that wraps API route handlers with error handling
 */
export function withErrorHandling(
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>,
  context?: string
) {
  return async (request: NextRequest, ...args: any[]): Promise<NextResponse> => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      const handlerContext = context || `${request.method} ${request.nextUrl.pathname}`;
      return ErrorHandler.handleError(error, handlerContext);
    }
  };
}

/**
 * Middleware for validating request content type
 */
export function validateContentType(request: NextRequest): NextResponse | null {
  const contentType = request.headers.get('content-type');
  
  if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
    if (!contentType || !contentType.includes('application/json')) {
      return createErrorNextResponse(
        ErrorCode.INVALID_PARAMETERS,
        'Content-Type must be application/json',
        { receivedContentType: contentType }
      );
    }
  }
  
  return null;
}

/**
 * Middleware for parsing and validating JSON body
 */
export async function parseAndValidateBody<T>(
  request: NextRequest,
  requiredFields?: string[]
): Promise<{ body: T; error?: NextResponse }> {
  try {
    const body = await request.json() as T;
    
    if (requiredFields) {
      const validationError = ErrorHandler.validateRequiredFields(body, requiredFields);
      if (validationError) {
        return { body, error: validationError };
      }
    }
    
    return { body };
  } catch (error) {
    return {
      body: {} as T,
      error: createErrorNextResponse(
        ErrorCode.INVALID_PARAMETERS,
        'Invalid JSON in request body'
      )
    };
  }
}

/**
 * Middleware for rate limiting (basic implementation)
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000 // 1 minute
): NextResponse | null {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  // Clean up old entries
  for (const [key, value] of rateLimitMap.entries()) {
    if (value.resetTime < windowStart) {
      rateLimitMap.delete(key);
    }
  }
  
  const current = rateLimitMap.get(identifier);
  
  if (!current) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
    return null;
  }
  
  if (current.resetTime < now) {
    // Reset window
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
    return null;
  }
  
  if (current.count >= maxRequests) {
    return createErrorNextResponse(
      ErrorCode.PIN_ATTEMPTS_EXCEEDED, // Reusing this for rate limiting
      'Rate limit exceeded. Please try again later.',
      { 
        maxRequests,
        windowMs,
        resetTime: current.resetTime
      }
    );
  }
  
  current.count++;
  return null;
}

/**
 * Comprehensive request validation middleware
 */
export async function validateRequest(
  request: NextRequest,
  options: {
    requiredFields?: string[];
    maxBodySize?: number;
    allowedMethods?: string[];
    rateLimitKey?: string;
    rateLimitMax?: number;
  } = {}
): Promise<{ body?: any; error?: NextResponse }> {
  const {
    requiredFields,
    maxBodySize = 1024 * 1024, // 1MB default
    allowedMethods,
    rateLimitKey,
    rateLimitMax = 100
  } = options;
  
  // Check allowed methods
  if (allowedMethods && !allowedMethods.includes(request.method)) {
    return {
      error: createErrorNextResponse(
        ErrorCode.INVALID_PARAMETERS,
        `Method ${request.method} not allowed`,
        { allowedMethods }
      )
    };
  }
  
  // Check rate limit
  if (rateLimitKey) {
    const rateLimitError = checkRateLimit(rateLimitKey, rateLimitMax);
    if (rateLimitError) {
      return { error: rateLimitError };
    }
  }
  
  // Validate content type for body-containing methods
  const contentTypeError = validateContentType(request);
  if (contentTypeError) {
    return { error: contentTypeError };
  }
  
  // Parse and validate body for POST/PUT/PATCH requests
  if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
    // Check body size (approximate)
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > maxBodySize) {
      return {
        error: createErrorNextResponse(
          ErrorCode.INVALID_PARAMETERS,
          'Request body too large',
          { maxSize: maxBodySize, receivedSize: contentLength }
        )
      };
    }
    
    const { body, error } = await parseAndValidateBody(request, requiredFields);
    if (error) {
      return { error };
    }
    
    return { body };
  }
  
  return {};
}

/**
 * Async wrapper that ensures proper error handling for async operations
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  context: string,
  fallbackCode: ErrorCode = ErrorCode.INTERNAL_ERROR
): Promise<{ result?: T; error?: NextResponse }> {
  try {
    const result = await operation();
    return { result };
  } catch (error) {
    return {
      error: ErrorHandler.handleError(error, context, fallbackCode)
    };
  }
}

/**
 * Database operation wrapper with error handling
 */
export async function withDatabaseTransaction<T>(
  operation: (client: any) => Promise<T>,
  pool: any,
  context: string = 'Database operation'
): Promise<{ result?: T; error?: NextResponse }> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return { result };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      // Log rollback error but don't throw - we want to return the original error
      console.error('Rollback failed:', rollbackError);
    }
    return {
      error: ErrorHandler.handleError(error, context, ErrorCode.DATABASE_ERROR)
    };
  } finally {
    client.release();
  }
}