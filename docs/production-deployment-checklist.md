# Production Deployment Checklist

## Pre-Deployment Preparation

### 1. Environment Configuration ✅
- [ ] All environment variables configured in `.env.production`
- [ ] ChipiPay mainnet API keys obtained and configured
- [ ] Database connection string configured for production
- [ ] JWT secrets generated (minimum 32 characters)
- [ ] Wallet encryption salt generated (minimum 32 characters)
- [ ] Rate limiting values configured appropriately
- [ ] Monitoring and alerting configuration set
- [ ] SSL certificates obtained and configured

**Validation Command:**
```bash
NODE_ENV=production node scripts/validate-deployment-config.js
```

### 2. Database Preparation ✅
- [ ] Production database created and accessible
- [ ] Database backup created before deployment
- [ ] Migration scripts tested on staging environment
- [ ] Rollback scripts prepared and tested
- [ ] Database connection pooling configured
- [ ] Database monitoring set up

**Commands:**
```bash
# Create backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Test migrations (dry run)
node scripts/run-migrations.js run --dry-run

# Check migration status
node scripts/run-migrations.js status
```

### 3. Security Verification ✅
- [ ] API keys are production keys (pk_prod_, sk_prod_)
- [ ] All secrets are properly secured and not in version control
- [ ] HTTPS enforced for all endpoints
- [ ] Rate limiting configured and tested
- [ ] Input validation implemented for all endpoints
- [ ] Authentication middleware tested
- [ ] PIN validation and encryption tested
- [ ] Security headers configured

**Security Test Commands:**
```bash
# Test API key validation
curl -X POST https://your-domain.com/api/merchants/wallet/transfer \
  -H "Authorization: Bearer invalid_key" \
  -H "Content-Type: application/json" \
  -d '{"pin":"123456","recipient":"0x123","amount":"1"}'

# Should return 401 Unauthorized
```

### 4. Code Quality and Testing ✅
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] End-to-end tests completed
- [ ] Security tests completed
- [ ] Performance tests completed
- [ ] Code coverage meets requirements (>90%)
- [ ] Code review completed
- [ ] Documentation updated

**Test Commands:**
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run integration tests
npm run test:integration

# Run e2e tests
npm run test:e2e
```

### 5. Infrastructure Preparation ✅
- [ ] Production server provisioned and configured
- [ ] Load balancer configured (if applicable)
- [ ] CDN configured for static assets
- [ ] Monitoring infrastructure set up
- [ ] Log aggregation configured
- [ ] Backup systems configured
- [ ] Disaster recovery plan documented

## Deployment Process

### Step 1: Final Pre-Deployment Checks ✅
```bash
# 1. Validate configuration
NODE_ENV=production node scripts/validate-deployment-config.js

# 2. Run final tests
npm run test:all

# 3. Build application
npm run build

# 4. Check build output
ls -la .next/

# 5. Verify no sensitive data in build
grep -r "sk_test\|sk_prod\|password" .next/ || echo "No secrets found in build"
```

### Step 2: Database Migration ✅
```bash
# 1. Create final backup
pg_dump $DATABASE_URL > final_backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Run migrations
node scripts/run-migrations.js run

# 3. Verify migration status
node scripts/run-migrations.js status

# 4. Test database connectivity
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT NOW()').then(() => {
  console.log('✅ Database connection successful');
  pool.end();
}).catch(err => {
  console.error('❌ Database connection failed:', err.message);
  process.exit(1);
});
"
```

### Step 3: Application Deployment ✅
```bash
# 1. Deploy application (method depends on your deployment strategy)
# Docker example:
docker build -t egyptfi-chipipay:latest -f Dockerfile.production .
docker run -d --name egyptfi-app --env-file .env.production -p 3000:3000 egyptfi-chipipay:latest

# 2. Wait for application to start
sleep 30

# 3. Verify application is running
curl -f http://localhost:3000/api/health || exit 1
```

### Step 4: Health Checks ✅
```bash
# 1. Run comprehensive health checks
node scripts/health-check.js

# 2. Test ChipiPay integration
curl -X GET https://your-domain.com/api/health \
  -H "Accept: application/json" | jq '.chipipay.status'

# 3. Test database connectivity
curl -X GET https://your-domain.com/api/health \
  -H "Accept: application/json" | jq '.database.status'

# 4. Test API endpoints
curl -X POST https://your-domain.com/api/merchants/register \
  -H "Content-Type: application/json" \
  -d '{"business_email":"test@example.com","pin":"123456"}' \
  | jq '.success'
```

### Step 5: Monitoring Setup ✅
```bash
# 1. Verify metrics collection
curl -X GET https://your-domain.com/api/metrics

# 2. Test alerting (if configured)
# This depends on your alerting system

# 3. Check log aggregation
tail -f /var/log/egyptfi/application.log

# 4. Verify monitoring dashboards are accessible
```

## Post-Deployment Verification

### 1. Functional Testing ✅
- [ ] User registration with ChipiPay wallet creation works
- [ ] API key authentication works
- [ ] PIN validation works
- [ ] Wallet operations (transfer, approve, stake, withdraw) work
- [ ] Error handling works correctly
- [ ] Rate limiting works
- [ ] Logging and metrics collection works

**Test Script:**
```bash
#!/bin/bash
# functional-test.sh

API_BASE="https://your-domain.com/api"

echo "🧪 Running functional tests..."

# Test 1: Health check
echo "1. Testing health check..."
curl -f "$API_BASE/health" || exit 1
echo "✅ Health check passed"

# Test 2: Registration
echo "2. Testing registration..."
REGISTER_RESPONSE=$(curl -s -X POST "$API_BASE/merchants/register" \
  -H "Content-Type: application/json" \
  -d '{"business_email":"test@example.com","pin":"123456"}')

if echo "$REGISTER_RESPONSE" | jq -e '.success' > /dev/null; then
  echo "✅ Registration test passed"
  API_KEY=$(echo "$REGISTER_RESPONSE" | jq -r '.apiKeys.testnet.publicKey')
else
  echo "❌ Registration test failed"
  exit 1
fi

# Test 3: API key validation
echo "3. Testing API key validation..."
curl -f -X GET "$API_BASE/merchants/profile" \
  -H "Authorization: Bearer $API_KEY" || exit 1
echo "✅ API key validation passed"

# Test 4: Invalid API key
echo "4. Testing invalid API key handling..."
INVALID_RESPONSE=$(curl -s -w "%{http_code}" -X GET "$API_BASE/merchants/profile" \
  -H "Authorization: Bearer invalid_key")

if [[ "$INVALID_RESPONSE" == *"401"* ]]; then
  echo "✅ Invalid API key handling passed"
else
  echo "❌ Invalid API key handling failed"
  exit 1
fi

echo "🎉 All functional tests passed!"
```

### 2. Performance Testing ✅
- [ ] Response times are acceptable (< 2s for wallet operations)
- [ ] System handles expected load
- [ ] Memory usage is stable
- [ ] Database performance is acceptable
- [ ] Rate limiting works under load

**Load Test Script:**
```bash
# Simple load test using curl
echo "🚀 Running load test..."

for i in {1..100}; do
  curl -s -o /dev/null -w "%{time_total}\n" \
    https://your-domain.com/api/health &
done

wait
echo "✅ Load test completed"
```

### 3. Security Testing ✅
- [ ] HTTPS is enforced
- [ ] API keys are properly validated
- [ ] PIN validation works correctly
- [ ] Rate limiting prevents abuse
- [ ] Input validation prevents injection attacks
- [ ] Error messages don't leak sensitive information

### 4. Monitoring Verification ✅
- [ ] Application metrics are being collected
- [ ] Database metrics are being collected
- [ ] Error rates are being tracked
- [ ] Response times are being monitored
- [ ] Alerts are configured and working
- [ ] Log aggregation is working
- [ ] Dashboards are accessible and showing data

## Rollback Procedures

### If Deployment Fails During Migration
```bash
# 1. Stop the application
docker stop egyptfi-app

# 2. Rollback database
node scripts/rollback-migrations.js

# 3. Restore from backup if needed
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql

# 4. Start previous version
docker run -d --name egyptfi-app-rollback previous-image:tag
```

### If Deployment Fails After Migration
```bash
# 1. Stop the new application
docker stop egyptfi-app

# 2. Start previous version (database should be compatible)
docker run -d --name egyptfi-app-rollback previous-image:tag

# 3. Monitor for issues
node scripts/health-check.js
```

### If Issues Discovered Post-Deployment
```bash
# 1. Assess severity
# - Critical: Immediate rollback
# - High: Plan rollback within 1 hour
# - Medium: Fix forward or plan rollback

# 2. For immediate rollback:
./scripts/emergency-rollback.sh

# 3. For planned rollback:
./scripts/planned-rollback.sh
```

## Emergency Contacts

### Technical Contacts
- **Lead Developer**: [name@company.com]
- **DevOps Engineer**: [devops@company.com]
- **Database Administrator**: [dba@company.com]

### Business Contacts
- **Product Manager**: [pm@company.com]
- **Customer Support**: [support@company.com]

### External Contacts
- **ChipiPay Support**: [support@chipipay.com]
- **Infrastructure Provider**: [support@provider.com]

## Post-Deployment Tasks

### Immediate (Within 1 hour)
- [ ] Monitor error rates and response times
- [ ] Check application logs for errors
- [ ] Verify all critical functionality works
- [ ] Monitor database performance
- [ ] Check ChipiPay integration status

### Short-term (Within 24 hours)
- [ ] Review monitoring dashboards
- [ ] Analyze performance metrics
- [ ] Check user feedback/support tickets
- [ ] Verify backup systems are working
- [ ] Update documentation with any changes

### Medium-term (Within 1 week)
- [ ] Conduct post-deployment review
- [ ] Update deployment procedures based on lessons learned
- [ ] Plan next deployment improvements
- [ ] Review and update monitoring/alerting rules
- [ ] Conduct disaster recovery test

## Success Criteria

The deployment is considered successful when:

- [ ] All health checks pass
- [ ] All functional tests pass
- [ ] Performance meets requirements
- [ ] Security tests pass
- [ ] Monitoring and alerting are working
- [ ] No critical errors in logs
- [ ] ChipiPay integration is fully functional
- [ ] User registration and wallet operations work
- [ ] Database migrations completed successfully
- [ ] Rollback procedures are tested and ready

## Documentation Updates

After successful deployment:

- [ ] Update API documentation with any changes
- [ ] Update deployment procedures
- [ ] Update monitoring runbooks
- [ ] Update troubleshooting guides
- [ ] Update emergency procedures
- [ ] Notify stakeholders of successful deployment

---

**Deployment Date**: _______________
**Deployed By**: _______________
**Version**: _______________
**Rollback Plan Confirmed**: _______________
**Success Criteria Met**: _______________