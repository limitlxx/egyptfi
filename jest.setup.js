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
