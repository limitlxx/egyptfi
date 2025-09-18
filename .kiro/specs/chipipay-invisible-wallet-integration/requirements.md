# Requirements Document

## Introduction

This feature integrates ChipiPay's invisible wallet creation and SDK functionality into the merchant registration process. The goal is to streamline merchant onboarding by automatically creating invisible wallets during signup and providing SDK-powered transaction capabilities for merchant operations. The process will be simplified to collect only email and PIN during registration while making the register_merchant contract call.

## Requirements

### Requirement 1: Invisible Wallet Creation During Registration

**User Story:** As a merchant, I want an invisible wallet to be automatically created when I sign up, so that I can immediately start accepting payments without complex wallet setup.

#### Acceptance Criteria

1. WHEN a merchant submits the registration form with email and PIN THEN the system SHALL create an invisible wallet using ChipiPay's createWallet function
2. WHEN the invisible wallet is created THEN the system SHALL store the encrypted private key and public key in the database
3. WHEN wallet creation fails THEN the system SHALL return an appropriate error message and not proceed with registration
4. WHEN the invisible wallet is successfully created THEN the system SHALL proceed with the register_merchant contract call
5. IF the merchant registration is successful THEN the system SHALL return the wallet details along with API keys

### Requirement 2: Simplified Registration Process

**User Story:** As a merchant, I want to register with just my email and PIN, so that the onboarding process is quick and simple.

#### Acceptance Criteria

1. WHEN a merchant accesses the registration form THEN the system SHALL only require email and PIN fields
2. WHEN the merchant submits the form THEN the system SHALL validate the email format and 6 digit PIN alphanumeric
3. WHEN validation passes THEN the system SHALL use the PIN as the encryption key for the invisible wallet
4. WHEN the registration is complete THEN the system SHALL store minimal merchant data (email, encrypted wallet info) in the database
5. IF the email already exists THEN the system SHALL return an error indicating the merchant already exists

### Requirement 3: ChipiPay SDK Integration for Merchant Operations

**User Story:** As a merchant, I want to use ChipiPay SDK features through API endpoints, so that I can perform wallet operations programmatically.

#### Acceptance Criteria

1. WHEN a merchant needs to transfer tokens THEN the system SHALL provide an API endpoint that uses ChipiPay's useTransfer hook
2. WHEN a merchant needs to approve token spending THEN the system SHALL provide an API endpoint that uses ChipiPay's useApprove hook
3. WHEN a merchant needs to stake USDC in VESU THEN the system SHALL provide an API endpoint that uses ChipiPay's useStakeVesuUsdc hook
4. WHEN a merchant needs to withdraw from VESU THEN the system SHALL provide an API endpoint that uses ChipiPay's useWithdrawVesuUsdc hook
5. WHEN a merchant needs to call any contract THEN the system SHALL provide an API endpoint that uses ChipiPay's useCallAnyContract hook
6. WHEN any SDK operation is requested THEN the system SHALL authenticate the merchant using their API key
7. WHEN any SDK operation requires the PIN THEN the system SHALL accept it as a parameter and use it to decrypt the private key

### Requirement 4: Secure Wallet Management

**User Story:** As a merchant, I want my wallet to be securely managed, so that my funds and private keys are protected.

#### Acceptance Criteria

1. WHEN a wallet is created THEN the system SHALL encrypt the private key using the merchant's PIN
2. WHEN wallet operations are performed THEN the system SHALL decrypt the private key only in memory and never store it unencrypted
3. WHEN API calls are made THEN the system SHALL validate the merchant's API key before allowing wallet operations
4. WHEN the PIN is provided THEN the system SHALL validate it can decrypt the private key before proceeding
5. IF decryption fails THEN the system SHALL return an authentication error

### Requirement 5: API Endpoint Structure

**User Story:** As a developer integrating with the merchant system, I want consistent API endpoints for wallet operations, so that I can easily implement ChipiPay features.

#### Acceptance Criteria

1. WHEN creating API endpoints THEN the system SHALL follow RESTful conventions
2. WHEN endpoints are accessed THEN the system SHALL require proper authentication headers (API key)
3. WHEN operations require PIN THEN the system SHALL accept it in the request body
4. WHEN operations are successful THEN the system SHALL return transaction hashes and relevant data
5. WHEN operations fail THEN the system SHALL return appropriate HTTP status codes and error messages
6. WHEN endpoints are documented THEN the system SHALL provide clear parameter descriptions and examples

### Requirement 6: Database Schema Updates

**User Story:** As a system administrator, I want the database to store invisible wallet information, so that merchant wallets can be managed and retrieved.

#### Acceptance Criteria

1. WHEN the database schema is updated THEN it SHALL include fields for encrypted private key and public key
2. WHEN merchant records are created THEN the system SHALL store the wallet information alongside merchant data
3. WHEN wallet information is retrieved THEN the system SHALL only return encrypted private keys
4. WHEN merchants are queried THEN the system SHALL be able to join wallet information efficiently
5. IF wallet information is missing THEN the system SHALL handle gracefully and indicate wallet creation is needed

### Requirement 7: Error Handling and Logging

**User Story:** As a system administrator, I want comprehensive error handling and logging, so that I can troubleshoot issues and monitor system health.

#### Acceptance Criteria

1. WHEN wallet creation fails THEN the system SHALL log the error details and return a user-friendly message
2. WHEN SDK operations fail THEN the system SHALL log the failure reason and return appropriate error codes
3. WHEN authentication fails THEN the system SHALL log the attempt and return unauthorized status
4. WHEN network issues occur THEN the system SHALL implement retry logic where appropriate
5. WHEN critical errors occur THEN the system SHALL alert administrators through appropriate channels

### Requirement 8: ChipiPay Configuration Management

**User Story:** As a system administrator, I want ChipiPay configuration to be properly managed, so that the integration works reliably across environments.

#### Acceptance Criteria

1. WHEN the system starts THEN it SHALL validate ChipiPay API credentials are properly configured
2. WHEN making ChipiPay API calls THEN the system SHALL use the correct environment endpoints (testnet/mainnet)
3. WHEN bearer tokens are needed THEN the system SHALL generate or retrieve them using the configured JWKS endpoint
4. WHEN configuration changes THEN the system SHALL reload without requiring full restart
5. IF ChipiPay services are unavailable THEN the system SHALL handle gracefully and provide fallback options where possible