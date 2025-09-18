# Implementation Plan

- [x] 1. Set up ChipiPay service layer and configuration

  - Create ChipiPay service class with wallet creation and SDK operations
  - Implement configuration management for ChipiPay API credentials
  - Add environment variable validation and configuration loading
  - _Requirements: 8.1, 8.2, 8.3_

- [x] 1.1 Create ChipiPay service interface and base implementation

  - Write TypeScript interfaces for all ChipiPay operations (createWallet, transfer, approve, etc.)
  - Implement ChipiPayService class with error handling and logging
  - Create unit tests for service methods with mocked ChipiPay responses
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 1.2 Implement ChipiPay configuration service

  - Create configuration service to manage API keys, JWKS endpoint, and environment settings
  - Add validation for required environment variables on startup
  - Implement bearer token generation using JWKS endpoint
  - Write unit tests for configuration validation and token generation
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 2. Update database schema for wallet storage

  - Add wallet-related columns to merchants table
  - Create ChipiPay configuration table
  - Create wallet operations log table for audit trail
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 2.1 Create database migration for wallet fields

  - Write SQL migration to add wallet_public_key, wallet_encrypted_private_key, wallet_created_at, and chipipay_external_user_id to merchants table
  - Make wallet_address nullable since ChipiPay wallets will be used
  - Create indexes for performance optimization on wallet-related queries
  - _Requirements: 6.1_

- [x] 2.2 Create ChipiPay configuration and logging tables

  - Write SQL migration for chipipay_config table with environment, API keys, and endpoints
  - Create wallet_operations_log table for transaction audit trail
  - Add appropriate constraints and indexes for optimal performance
  - _Requirements: 6.2, 6.3_

- [x] 3. Modify merchant registration to use ChipiPay invisible wallets

  - Update registration API to accept only email and PIN
  - Integrate ChipiPay wallet creation into registration flow
  - Update database operations to store wallet information
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3.1 Update registration request interface and validation

  - Modify registration API to accept SimplifiedRegistrationRequest with email and PIN
  - Implement PIN strength validation (4-8 digits, configurable pattern)
  - Update email validation to ensure uniqueness in database
  - Write unit tests for input validation logic
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 3.2 Integrate ChipiPay wallet creation into registration flow

  - Modify registration route to call ChipiPay createWallet function
  - Use PIN as encryption key for invisible wallet creation
  - Handle ChipiPay API errors and provide user-friendly error messages
  - Store encrypted private key and public key in database
  - _Requirements: 1.1, 1.2, 1.3, 2.4_

- [x] 3.3 Update registration response and error handling

  - Modify registration response to include wallet public key (not private key)
  - Implement comprehensive error handling for wallet creation failures
  - Add logging for registration attempts and wallet creation status
  - Write integration tests for complete registration flow
  - _Requirements: 1.4, 1.5, 7.1, 7.2, 7.3_

- [x] 4. Create authentication middleware for wallet operations

  - Implement API key validation middleware
  - Create PIN validation and wallet decryption utilities
  - Add bearer token generation for ChipiPay operations
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 4.1 Implement API key authentication middleware

  - Create middleware to validate merchant API keys from request headers
  - Retrieve merchant data and wallet information based on API key
  - Implement rate limiting per merchant to prevent abuse
  - Write unit tests for authentication scenarios (valid, invalid, expired keys)
  - _Requirements: 4.1, 4.2_

- [x] 4.2 Create PIN validation and wallet decryption service

  - Implement secure PIN validation by attempting wallet decryption
  - Create utility functions to encrypt/decrypt private keys using PIN + salt
  - Add failed attempt tracking and temporary lockout mechanism
  - Write unit tests for encryption/decryption and PIN validation
  - _Requirements: 4.3, 4.4, 4.5_

- [x] 4.3 Implement bearer token generation for ChipiPay

  - Create service to generate JWT bearer tokens using merchant data
  - Implement token caching with appropriate expiration times
  - Add token refresh logic for long-running operations
  - Write unit tests for token generation and validation
  - _Requirements: 3.7, 8.3_

- [x] 5. Create ChipiPay SDK API endpoints for wallet operations

  - Implement transfer endpoint using ChipiPay useTransfer hook
  - Create approve endpoint using ChipiPay useApprove hook
  - Add VESU staking and withdrawal endpoints
  - Implement generic contract call endpoint
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 5.1 Create transfer API endpoint

  - Implement POST /api/merchants/wallet/transfer endpoint
  - Validate transfer parameters (recipient, amount, contract address)
  - Use ChipiPay useTransfer hook to execute blockchain transaction
  - Return transaction hash and log operation in database
  - Write unit and integration tests for transfer operations
  - _Requirements: 3.1, 5.1, 5.2, 5.3, 5.4_

- [x] 5.2 Create approve API endpoint

  - Implement POST /api/merchants/wallet/approve endpoint
  - Validate approval parameters (contract address, spender, amount)
  - Use ChipiPay useApprove hook to grant token spending permission
  - Handle approval-specific errors and edge cases
  - Write unit and integration tests for approval operations
  - _Requirements: 3.2, 5.1, 5.2, 5.3, 5.4_

- [x] 5.3 Create VESU staking and withdrawal endpoints

  - Implement POST /api/merchants/wallet/stake-vesu-usdc endpoint using useStakeVesuUsdc hook
  - Implement POST /api/merchants/wallet/withdraw-vesu-usdc endpoint using useWithdrawVesuUsdc hook
  - Validate VESU-specific parameters (amounts, receiver addresses)
  - Add VESU protocol error handling and user-friendly messages
  - Write unit and integration tests for VESU operations
  - _Requirements: 3.3, 3.4, 5.1, 5.2, 5.3, 5.4_

- [x] 5.4 Create generic contract call endpoint

  - Implement POST /api/merchants/wallet/call-contract endpoint using useCallAnyContract hook
  - Validate contract address, entrypoint, and calldata parameters
  - Add security checks for potentially dangerous contract calls
  - Implement flexible parameter handling for various contract interfaces
  - Write unit and integration tests for contract call operations
  - _Requirements: 3.5, 5.1, 5.2, 5.3, 5.4_

- [-] 6. Implement comprehensive error handling and logging

  - Create standardized error response format
  - Add operation logging for audit trail
  - Implement retry logic for network failures
  - Add monitoring and alerting capabilities
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 6.1 Create standardized error handling system

  - Define error codes and categories for different failure types
  - Implement ErrorResponse interface with consistent format
  - Create error handling middleware for API endpoints
  - Add user-friendly error messages while preserving technical details for logs
  - Write unit tests for error handling scenarios
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 6.2 Implement comprehensive logging and audit trail

  - Add structured logging for all wallet operations with correlation IDs
  - Log security events (authentication failures, suspicious activity)
  - Create audit trail in wallet_operations_log table
  - Implement log rotation and retention policies
  - Write tests to verify logging functionality
  - _Requirements: 7.4, 7.5_

- [x] 6.3 Add retry logic and network resilience

  - Implement exponential backoff for ChipiPay API calls
  - Add circuit breaker pattern for external service failures
  - Create fallback mechanisms where appropriate
  - Add network timeout configuration and handling
  - Write integration tests for network failure scenarios
  - _Requirements: 7.4, 7.5_

- [-] 7. Create comprehensive test suite

  - Write unit tests for all service classes and utilities
  - Create integration tests for API endpoints
  - Add end-to-end tests for complete user flows
  - Implement security tests for authentication and encryption
  - _Requirements: All requirements validation_

- [ ] 7.1 Write unit tests for ChipiPay service layer

  - Test ChipiPayService methods with mocked API responses
  - Test configuration service with various environment setups
  - Test authentication middleware with valid and invalid scenarios
  - Test encryption/decryption utilities with various PIN formats
  - Achieve >90% code coverage for service layer
  - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2, 4.3_

- [ ] 7.2 Create integration tests for API endpoints

  - Test complete registration flow with ChipiPay wallet creation
  - Test all wallet operation endpoints with real ChipiPay testnet
  - Test authentication flow with API keys and PIN validation
  - Test error scenarios and edge cases for all endpoints
  - Verify database operations and audit logging
  - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 7.3 Implement end-to-end and security tests

  - Create complete user journey tests from registration to wallet operations
  - Test security measures (PIN validation, API key security, encryption)
  - Test rate limiting and abuse prevention mechanisms
  - Verify audit trail and logging functionality
  - Test performance under load with multiple concurrent operations
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 7.1, 7.2, 7.3_

- [ ] 8. Update frontend registration form

  - Simplify registration form to collect only email and PIN
  - Update form validation for new simplified flow
  - Modify success/error handling for wallet creation
  - Update user feedback and loading states
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 8.1 Simplify registration form UI

  - Remove business information fields from registration form
  - Add PIN input field with appropriate validation and security
  - Update form styling and user experience for simplified flow
  - Add helpful text explaining the PIN requirement and security
  - Write component tests for form validation and submission
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 8.2 Update registration form logic and API integration

  - Modify form submission to send only email and PIN to API
  - Update success handling to show wallet creation confirmation
  - Improve error handling for ChipiPay wallet creation failures
  - Add loading states and progress indicators for wallet creation
  - Test form integration with updated registration API
  - _Requirements: 2.4, 2.5, 1.4, 1.5_

- [ ] 9. Add monitoring and observability

  - Implement metrics collection for wallet operations
  - Add health checks for ChipiPay API connectivity
  - Create dashboards for monitoring system performance
  - Set up alerting for critical failures
  - _Requirements: 7.4, 7.5, 8.5_

- [ ] 9.1 Implement metrics and monitoring

  - Add metrics collection for wallet creation success rates
  - Track transaction success rates by operation type
  - Monitor API response times and error rates
  - Create health check endpoints for system status
  - Write tests for metrics collection functionality
  - _Requirements: 7.4, 7.5_

- [ ] 9.2 Set up alerting and dashboards

  - Configure alerts for high error rates and API downtime
  - Create monitoring dashboards for system health visualization
  - Set up log aggregation and search capabilities
  - Implement automated incident response for critical failures
  - Document monitoring and alerting procedures
  - _Requirements: 8.5, 7.5_

- [ ] 10. Documentation and deployment preparation

  - Create API documentation for new endpoints
  - Update deployment configuration for new environment variables
  - Create migration scripts for database changes
  - Document ChipiPay integration setup and configuration
  - _Requirements: 5.6, 8.1, 8.2, 8.3, 8.4_

- [ ] 10.1 Create comprehensive API documentation

  - Document all new wallet operation endpoints with examples
  - Create authentication guide for API key usage
  - Document error codes and troubleshooting guide
  - Add integration examples for common use cases
  - Create developer onboarding guide for ChipiPay features
  - _Requirements: 5.6_

- [ ] 10.2 Prepare deployment configuration
  - Update environment variable configuration for ChipiPay integration
  - Create database migration scripts for production deployment
  - Update Docker configuration and deployment scripts
  - Create rollback procedures for failed deployments
  - Document production deployment and configuration steps
  - _Requirements: 8.1, 8.2, 8.3, 8.4_
