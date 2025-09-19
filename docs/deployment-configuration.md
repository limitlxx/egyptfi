# ChipiPay Integration Deployment Configuration

## Overview

This guide covers the complete deployment configuration for the ChipiPay invisible wallet integration, including environment variables, database migrations, and production deployment procedures.

## Environment Variables

### Required Environment Variables

#### Core Application Settings
```bash
# Database Configuration
DATABASE_URL="postgresql://username:password@host:port/database"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-min-32-chars"
EGYPTFI_SECRET="your-egyptfi-master-secret"

# Application URLs
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

#### ChipiPay Integration Settings
```bash
# ChipiPay Backend Configuration
CHIPIPAY_BACKEND_URL=https://api.chipipay.com/v1
CHIPIPAY_JWKS_ENDPOINT=https://your-auth-provider.com/.well-known/jwks.json
CHIPIPAY_TIMEOUT=30000

# ChipiPay API Keys - Testnet
CHIPIPAY_API_PUBLIC_KEY_TESTNET=pk_test_your_testnet_public_key
CHIPIPAY_API_SECRET_KEY_TESTNET=sk_test_your_testnet_secret_key

# ChipiPay API Keys - Mainnet
CHIPIPAY_API_PUBLIC_KEY_MAINNET=pk_prod_your_mainnet_public_key
CHIPIPAY_API_SECRET_KEY_MAINNET=sk_prod_your_mainnet_secret_key
```

#### Starknet Configuration
```bash
# Starknet RPC URLs
STARKNET_RPC_URL_TESTNET=https://starknet-sepolia.infura.io/v3/YOUR_PROJECT_ID
STARKNET_RPC_URL_MAINNET=https://starknet-mainnet.infura.io/v3/YOUR_PROJECT_ID

# Starknet Contract Addresses
NEXT_PUBLIC_EGYPT_SEPOLIA_CONTRACT_ADDRESS=0x02680191ae87ed05ee564c8e468495c760ba1764065de451fe51bb097e64d062
NEXT_PUBLIC_EGYPT_MAINNET_CONTRACT_ADDRESS=0x_your_mainnet_contract_address
```

#### Security Configuration
```bash
# Wallet Security
WALLET_ENCRYPTION_SALT=your-secure-salt-for-wallet-encryption-min-32-chars
PIN_VALIDATION_REGEX=^[a-zA-Z0-9]{4,8}$
MAX_PIN_ATTEMPTS=3
PIN_LOCKOUT_TIME=300000

# Rate Limiting
RATE_LIMIT_REQUESTS_PER_MINUTE=100
RATE_LIMIT_WALLET_OPS_PER_MINUTE=10
RATE_LIMIT_REQUESTS_PER_HOUR=1000
```

#### Monitoring and Alerting
```bash
# Monitoring Configuration
ENABLE_METRICS=true
ENABLE_ALERTING=true
ALERT_EMAIL=admin@your-domain.com
ALERT_WEBHOOK_URL=https://your-monitoring-service.com/webhook

# Logging Configuration
LOG_LEVEL=info
LOG_ROTATION_SIZE=100MB
LOG_RETENTION_DAYS=30
```

### Environment-Specific Configuration

#### Development (.env.local)
```bash
NODE_ENV=development
CHIPIPAY_API_PUBLIC_KEY_TESTNET=pk_test_dev_key
CHIPIPAY_API_SECRET_KEY_TESTNET=sk_test_dev_key
STARKNET_RPC_URL_TESTNET=https://starknet-sepolia.public.blastapi.io
DATABASE_URL="postgresql://dev_user:dev_pass@localhost:5432/egyptfi_dev"
LOG_LEVEL=debug
ENABLE_METRICS=false
```

#### Staging (.env.staging)
```bash
NODE_ENV=staging
CHIPIPAY_API_PUBLIC_KEY_TESTNET=pk_test_staging_key
CHIPIPAY_API_SECRET_KEY_TESTNET=sk_test_staging_key
STARKNET_RPC_URL_TESTNET=https://starknet-sepolia.infura.io/v3/STAGING_PROJECT_ID
DATABASE_URL="postgresql://staging_user:staging_pass@staging-db:5432/egyptfi_staging"
LOG_LEVEL=info
ENABLE_METRICS=true
ENABLE_ALERTING=false
```

#### Production (.env.production)
```bash
NODE_ENV=production
CHIPIPAY_API_PUBLIC_KEY_MAINNET=pk_prod_production_key
CHIPIPAY_API_SECRET_KEY_MAINNET=sk_prod_production_key
STARKNET_RPC_URL_MAINNET=https://starknet-mainnet.infura.io/v3/PRODUCTION_PROJECT_ID
DATABASE_URL="postgresql://prod_user:secure_pass@prod-db:5432/egyptfi_prod"
LOG_LEVEL=warn
ENABLE_METRICS=true
ENABLE_ALERTING=true
```

## Database Migration Scripts

### Migration Files Location
All migration files are located in `database/migrations/` and should be executed in order.

### Required Migrations for ChipiPay Integration

#### 1. Wallet Fields Migration
**File**: `database/migrations/001_add_wallet_fields_to_merchants.sql`

```sql
-- Add wallet-related columns to merchants table
ALTER TABLE merchants 
ADD COLUMN IF NOT EXISTS wallet_public_key TEXT,
ADD COLUMN IF NOT EXISTS wallet_encrypted_private_key TEXT,
ADD COLUMN IF NOT EXISTS wallet_created_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS chipipay_external_user_id TEXT;

-- Make wallet_address nullable since we'll use ChipiPay wallets
ALTER TABLE merchants ALTER COLUMN wallet_address DROP NOT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_merchants_wallet_public_key ON merchants(wallet_public_key);
CREATE INDEX IF NOT EXISTS idx_merchants_chipipay_external_user_id ON merchants(chipipay_external_user_id);
CREATE INDEX IF NOT EXISTS idx_merchants_wallet_created_at ON merchants(wallet_created_at);

-- Add constraints
ALTER TABLE merchants ADD CONSTRAINT chk_wallet_keys_together 
CHECK (
  (wallet_public_key IS NULL AND wallet_encrypted_private_key IS NULL) OR
  (wallet_public_key IS NOT NULL AND wallet_encrypted_private_key IS NOT NULL)
);
```

#### 2. ChipiPay Configuration and Logging Tables
**File**: `database/migrations/002_create_chipipay_config_and_logging_tables.sql`

```sql
-- Create ChipiPay configuration table
CREATE TABLE IF NOT EXISTS chipipay_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment VARCHAR(10) NOT NULL CHECK (environment IN ('testnet', 'mainnet')),
    api_public_key TEXT NOT NULL,
    jwks_endpoint TEXT NOT NULL,
    backend_url TEXT NOT NULL DEFAULT 'https://api.chipipay.com/v1',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(environment)
);

-- Create wallet operations log table
CREATE TABLE IF NOT EXISTS wallet_operations_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    operation_type VARCHAR(50) NOT NULL,
    contract_address TEXT,
    amount DECIMAL(18,8),
    recipient TEXT,
    tx_hash TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Add indexes for wallet operations log
CREATE INDEX IF NOT EXISTS idx_wallet_ops_merchant_id ON wallet_operations_log(merchant_id);
CREATE INDEX IF NOT EXISTS idx_wallet_ops_operation_type ON wallet_operations_log(operation_type);
CREATE INDEX IF NOT EXISTS idx_wallet_ops_status ON wallet_operations_log(status);
CREATE INDEX IF NOT EXISTS idx_wallet_ops_created_at ON wallet_operations_log(created_at);
CREATE INDEX IF NOT EXISTS idx_wallet_ops_tx_hash ON wallet_operations_log(tx_hash);

-- Insert default ChipiPay configuration
INSERT INTO chipipay_config (environment, api_public_key, jwks_endpoint, backend_url)
VALUES 
  ('testnet', 'pk_test_placeholder', 'https://your-auth-provider.com/.well-known/jwks.json', 'https://api.chipipay.com/v1'),
  ('mainnet', 'pk_prod_placeholder', 'https://your-auth-provider.com/.well-known/jwks.json', 'https://api.chipipay.com/v1')
ON CONFLICT (environment) DO NOTHING;
```

#### 3. Enhanced Logging Tables
**File**: `database/migrations/003_create_logging_tables.sql`

```sql
-- Create system logs table for application logging
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level VARCHAR(10) NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal')),
    message TEXT NOT NULL,
    context JSONB,
    correlation_id VARCHAR(50),
    user_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create security events log
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT NOT NULL,
    user_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for logging tables
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_system_logs_correlation_id ON system_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);
```

#### 4. Metrics Tables
**File**: `database/migrations/004_create_metrics_tables.sql`

```sql
-- Create metrics table for system monitoring
CREATE TABLE IF NOT EXISTS metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(18,8) NOT NULL,
    metric_type VARCHAR(20) NOT NULL CHECK (metric_type IN ('counter', 'gauge', 'histogram', 'summary')),
    labels JSONB,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Create alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_name VARCHAR(100) NOT NULL,
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    message TEXT NOT NULL,
    metadata JSONB,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

-- Add indexes for metrics and alerts
CREATE INDEX IF NOT EXISTS idx_metrics_name_timestamp ON metrics(metric_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_alerts_severity_resolved ON alerts(severity, resolved);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);
```

### Migration Execution Script

Create a migration runner script:

**File**: `scripts/run-migrations.js`

```javascript
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // Create migrations tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Get list of migration files
    const migrationsDir = path.join(__dirname, '../database/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    console.log(`Found ${migrationFiles.length} migration files`);

    for (const file of migrationFiles) {
      const version = file.replace('.sql', '');
      
      // Check if migration already applied
      const { rows } = await pool.query(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [version]
      );

      if (rows.length > 0) {
        console.log(`⏭️  Skipping ${file} (already applied)`);
        continue;
      }

      console.log(`🔄 Applying ${file}...`);

      // Read and execute migration
      const migrationSQL = fs.readFileSync(
        path.join(migrationsDir, file),
        'utf8'
      );

      await pool.query('BEGIN');
      
      try {
        await pool.query(migrationSQL);
        await pool.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [version]
        );
        await pool.query('COMMIT');
        
        console.log(`✅ Applied ${file}`);
      } catch (error) {
        await pool.query('ROLLBACK');
        throw error;
      }
    }

    console.log('🎉 All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
```

## Rollback Procedures

### Database Rollback Script

**File**: `scripts/rollback-migrations.js`

```javascript
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function rollbackMigrations(targetVersion = null) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // Get applied migrations
    const { rows: appliedMigrations } = await pool.query(
      'SELECT version FROM schema_migrations ORDER BY version DESC'
    );

    console.log(`Found ${appliedMigrations.length} applied migrations`);

    for (const { version } of appliedMigrations) {
      if (targetVersion && version <= targetVersion) {
        console.log(`🛑 Stopping rollback at version ${version}`);
        break;
      }

      const rollbackFile = path.join(
        __dirname,
        '../database/migrations',
        `rollback_${version}.sql`
      );

      if (!fs.existsSync(rollbackFile)) {
        console.log(`⚠️  No rollback script found for ${version}`);
        continue;
      }

      console.log(`🔄 Rolling back ${version}...`);

      const rollbackSQL = fs.readFileSync(rollbackFile, 'utf8');

      await pool.query('BEGIN');
      
      try {
        await pool.query(rollbackSQL);
        await pool.query(
          'DELETE FROM schema_migrations WHERE version = $1',
          [version]
        );
        await pool.query('COMMIT');
        
        console.log(`✅ Rolled back ${version}`);
      } catch (error) {
        await pool.query('ROLLBACK');
        throw error;
      }
    }

    console.log('🎉 Rollback completed successfully');
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  const targetVersion = process.argv[2];
  rollbackMigrations(targetVersion);
}

module.exports = { rollbackMigrations };
```

### ChipiPay Integration Rollback

**File**: `database/migrations/rollback_chipipay_wallet_integration.sql`

```sql
-- Rollback ChipiPay wallet integration changes

-- Remove wallet fields from merchants table
ALTER TABLE merchants 
DROP COLUMN IF EXISTS wallet_public_key,
DROP COLUMN IF EXISTS wallet_encrypted_private_key,
DROP COLUMN IF EXISTS wallet_created_at,
DROP COLUMN IF EXISTS chipipay_external_user_id;

-- Restore wallet_address as NOT NULL if needed
-- ALTER TABLE merchants ALTER COLUMN wallet_address SET NOT NULL;

-- Drop ChipiPay-related tables
DROP TABLE IF EXISTS wallet_operations_log;
DROP TABLE IF EXISTS chipipay_config;
DROP TABLE IF EXISTS system_logs;
DROP TABLE IF EXISTS security_events;
DROP TABLE IF EXISTS metrics;
DROP TABLE IF EXISTS alerts;

-- Drop indexes (they will be dropped automatically with the tables)
```

## Production Deployment Steps

### Pre-Deployment Checklist

1. **Environment Variables**
   - [ ] All required environment variables set
   - [ ] API keys are production keys (pk_prod_, sk_prod_)
   - [ ] Database URL points to production database
   - [ ] Secrets are properly secured

2. **Database**
   - [ ] Database backup created
   - [ ] Migration scripts tested on staging
   - [ ] Rollback scripts prepared

3. **Security**
   - [ ] SSL certificates configured
   - [ ] Rate limiting configured
   - [ ] Monitoring and alerting set up

4. **Testing**
   - [ ] All tests passing
   - [ ] Integration tests run against staging
   - [ ] Load testing completed

### Deployment Script

**File**: `scripts/deploy.sh`

```bash
#!/bin/bash

set -e

echo "🚀 Starting ChipiPay Integration Deployment"

# Check environment
if [ "$NODE_ENV" != "production" ]; then
  echo "❌ NODE_ENV must be set to 'production'"
  exit 1
fi

# Validate required environment variables
required_vars=(
  "DATABASE_URL"
  "CHIPIPAY_API_PUBLIC_KEY_MAINNET"
  "CHIPIPAY_API_SECRET_KEY_MAINNET"
  "STARKNET_RPC_URL_MAINNET"
  "JWT_SECRET"
  "WALLET_ENCRYPTION_SALT"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Required environment variable $var is not set"
    exit 1
  fi
done

echo "✅ Environment variables validated"

# Create database backup
echo "📦 Creating database backup..."
pg_dump $DATABASE_URL > "backup_$(date +%Y%m%d_%H%M%S).sql"
echo "✅ Database backup created"

# Run database migrations
echo "🔄 Running database migrations..."
node scripts/run-migrations.js
echo "✅ Database migrations completed"

# Build application
echo "🔨 Building application..."
npm run build
echo "✅ Application built"

# Run health checks
echo "🏥 Running health checks..."
npm run health-check
echo "✅ Health checks passed"

# Start application
echo "🎉 Deployment completed successfully"
echo "🌐 Application is now running with ChipiPay integration"
```

### Health Check Script

**File**: `scripts/health-check.js`

```javascript
const fetch = require('node-fetch');

async function runHealthChecks() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  const checks = [
    {
      name: 'Application Health',
      url: `${baseUrl}/api/health`,
      expected: { status: 'healthy' }
    },
    {
      name: 'Database Connectivity',
      url: `${baseUrl}/api/health`,
      expected: { database: { status: 'healthy' } }
    },
    {
      name: 'ChipiPay Integration',
      url: `${baseUrl}/api/health`,
      expected: { chipipay: { status: 'healthy' } }
    }
  ];

  console.log('🏥 Running health checks...\n');

  let allHealthy = true;

  for (const check of checks) {
    try {
      const response = await fetch(check.url);
      const data = await response.json();
      
      const isHealthy = response.ok && checkExpected(data, check.expected);
      
      console.log(`${isHealthy ? '✅' : '❌'} ${check.name}: ${isHealthy ? 'Healthy' : 'Unhealthy'}`);
      
      if (!isHealthy) {
        allHealthy = false;
        console.log(`   Response:`, data);
      }
    } catch (error) {
      console.log(`❌ ${check.name}: Error - ${error.message}`);
      allHealthy = false;
    }
  }

  if (!allHealthy) {
    console.log('\n❌ Health checks failed');
    process.exit(1);
  }

  console.log('\n✅ All health checks passed');
}

function checkExpected(data, expected) {
  for (const [key, value] of Object.entries(expected)) {
    if (typeof value === 'object') {
      if (!data[key] || !checkExpected(data[key], value)) {
        return false;
      }
    } else {
      if (data[key] !== value) {
        return false;
      }
    }
  }
  return true;
}

if (require.main === module) {
  runHealthChecks();
}

module.exports = { runHealthChecks };
```

### Docker Configuration

**File**: `Dockerfile.production`

```dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy migration scripts
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/database ./database

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

**File**: `docker-compose.production.yml`

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.production
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - CHIPIPAY_API_PUBLIC_KEY_MAINNET=${CHIPIPAY_API_PUBLIC_KEY_MAINNET}
      - CHIPIPAY_API_SECRET_KEY_MAINNET=${CHIPIPAY_API_SECRET_KEY_MAINNET}
      - STARKNET_RPC_URL_MAINNET=${STARKNET_RPC_URL_MAINNET}
      - JWT_SECRET=${JWT_SECRET}
      - WALLET_ENCRYPTION_SALT=${WALLET_ENCRYPTION_SALT}
    depends_on:
      - postgres
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "scripts/health-check.js"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=${POSTGRES_DB}
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/migrations:/docker-entrypoint-initdb.d
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

## Monitoring and Maintenance

### Log Rotation Configuration

**File**: `config/logrotate.conf`

```
/var/log/egyptfi/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 nextjs nodejs
    postrotate
        systemctl reload egyptfi
    endscript
}
```

### Backup Script

**File**: `scripts/backup.sh`

```bash
#!/bin/bash

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
echo "Creating database backup..."
pg_dump $DATABASE_URL | gzip > "$BACKUP_DIR/database_$DATE.sql.gz"

# Environment backup (without secrets)
echo "Creating environment backup..."
env | grep -E '^(NEXT_PUBLIC_|NODE_ENV|PORT)' > "$BACKUP_DIR/env_$DATE.txt"

# Clean old backups (keep 30 days)
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete
find $BACKUP_DIR -name "*.txt" -mtime +30 -delete

echo "Backup completed: $DATE"
```

This deployment configuration provides a comprehensive setup for the ChipiPay integration in production environments.