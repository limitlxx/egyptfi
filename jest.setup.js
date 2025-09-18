<<<<<<< HEAD
import '@testing-library/jest-dom'

// Mock environment variables
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.NODE_ENV = 'test'
process.env.CHIPIPAY_API_URL = 'https://api.test.chipipay.com'
process.env.CHIPIPAY_API_KEY = 'test-api-key'
process.env.JWT_SECRET = 'test-jwt-secret'

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to ignore specific log levels
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
}
=======
// Jest setup file for global test configuration

// Mock environment variables for tests
process.env.CHIPIPAY_URL = 'https://test-api.chipipay.com/v1'
process.env.CHIPI_PUBLIC_KEY = 'pk_test_123'
process.env.CHIPI_SECRET_KEY = 'sk_test_123'

// Global test utilities can be added here
>>>>>>> backend
