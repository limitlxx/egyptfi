// Jest setup file for global test configuration

// Mock environment variables for tests
process.env.CHIPIPAY_URL = 'https://test-api.chipipay.com/v1'
process.env.CHIPI_PUBLIC_KEY = 'pk_test_123'
process.env.CHIPI_SECRET_KEY = 'sk_test_123'

// Global test utilities can be added here