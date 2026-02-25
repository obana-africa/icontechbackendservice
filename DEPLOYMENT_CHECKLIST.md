# T2Mobile Integration - Pre-Deployment Checklist

Use this checklist to verify everything is working before deploying to production.

---

## Pre-Deployment Configuration ✓

### Environment Setup
- [ ] `.env.local` file created with all variables
- [ ] `T2MOBILE_API_KEY` obtained from T2Mobile (kenneth.epiah@t2mobile.com.ng)
- [ ] `T2MOBILE_WEBHOOK_SECRET` obtained from T2Mobile
- [ ] `T2MOBILE_WEBHOOK_URL` confirmed with T2Mobile
- [ ] Zoho credentials configured:
  - [ ] `ZOHO_ORGANIZATION_ID` set
  - [ ] `ZOHO_CLIENT_ID` set
  - [ ] `ZOHO_CLIENT_SECRET` set
  - [ ] `ZOHO_REFRESH_TOKEN` obtained
- [ ] `REDIS_HOST` and `REDIS_PORT` configured
- [ ] Database connection verified
- [ ] Environment variables NOT committed to git

### Dependencies
- [ ] `npm install bull redis uuid node-cron express-rate-limit` completed
- [ ] `package.json` updated with new dependencies
- [ ] `package-lock.json` generated
- [ ] Dependency versions specified in package.json

### Database
- [ ] Database connection tested: `mysql -u user -p -h host database`
- [ ] Three new tables will auto-create on app start:
  - [ ] `t2mobile_orders` verification in production DB
  - [ ] `t2mobile_fulfillments` verification in production DB
  - [ ] `t2mobile_webhook_logs` verification in production DB
- [ ] Database user has CREATE, ALTER, INSERT, SELECT, UPDATE permissions
- [ ] Backup created before deployment

### Redis
- [ ] Redis server running and accessible
- [ ] Redis connection test passed: `redis-cli ping` → PONG
- [ ] Redis persistence configured (if required)
- [ ] Redis password set (if required)
- [ ] Redis memory limits configured

---

## Code Quality ✓

### Syntax & Linting
- [ ] No TypeScript/ESLint errors: `npm run lint`
- [ ] All new files follow existing code style
- [ ] No unused variables or imports
- [ ] Comments added for complex logic
- [ ] Error handling present in all async functions

### Security Review
- [ ] No hardcoded credentials anywhere
- [ ] All API keys loaded from environment variables
- [ ] HMAC signing verified with correct secret
- [ ] Input validation on all endpoints
- [ ] Rate limiting configured (100 req/min)
- [ ] Error messages don't leak system details
- [ ] Sensitive data masked in logs

### Testing
- [ ] GET /products endpoint responds with 200
- [ ] POST /fulfilment endpoint responds with 202
- [ ] Duplicate order detection working (idempotency)
- [ ] Invalid API key returns 401
- [ ] Invalid payload returns 400
- [ ] Rate limiting triggers at 100+ requests

---

## Functionality Testing ✓

### Test 1: API Key Validation
```bash
# This should fail with 401
curl -X GET http://localhost:4000/t2mobile/products \
  -H "Authorization: Bearer INVALID_KEY"
```
- [ ] Response Status: 401 Unauthorized
- [ ] Response includes errorCode: INVALID_API_KEY

### Test 2: Get Products
```bash
# This should succeed
curl -X GET http://localhost:4000/t2mobile/products \
  -H "Authorization: Bearer YOUR_API_KEY"
```
- [ ] Response Status: 200 OK
- [ ] Response includes partnerId: ICONTECH001
- [ ] Response includes array of products
- [ ] Each product has: productId, name, cost, currency, tenure

### Test 3: Successful Order Submission
```bash
curl -X POST http://localhost:4000/t2mobile/fulfilment \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Idempotency-Key: test-order-001" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "T2M_TEST_001",
    "productId": "ZOHO_CRM_STD",
    "customerId": "TEST_CUST_001",
    "customerName": "Test Customer",
    "customerEmail": "test@example.com",
    "customerPhone": "08012345678",
    "tenure": "12_MONTHS"
  }'
```
- [ ] Response Status: 202 Accepted
- [ ] Response includes success: true
- [ ] Response includes orderId: T2M_TEST_001
- [ ] Response includes status: PROCESSING
- [ ] Order appears in database with status PENDING

### Test 4: Idempotency Check
```bash
# Send the same request again with same Idempotency-Key
curl -X POST http://localhost:4000/t2mobile/fulfilment \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Idempotency-Key: test-order-001" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "T2M_TEST_001",
    ...
  }'
```
- [ ] Response Status: 200 OK (not 202)
- [ ] Response includes isDuplicate: true
- [ ] Only one order in database (no duplicate)

### Test 5: Order Status Query
```bash
curl -X GET http://localhost:4000/t2mobile/orders/T2M_TEST_001 \
  -H "Authorization: Bearer YOUR_API_KEY"
```
- [ ] Response Status: 200 OK
- [ ] Response includes order details
- [ ] Status field shows current status (should progress from PENDING → PROCESSING → FULFILLED)

### Test 6: Job Queue Processing
```bash
# Wait 5-10 seconds, then check job completion
# Order should progress: PENDING → PROCESSING → FULFILLED
```
- [ ] Check database: order status changed from PENDING
- [ ] Check Redis for completed job: `redis-cli LLEN bull:t2mobile-orders:completed`
- [ ] Logs show: `[T2Mobile Order Job] Order T2M_TEST_001 fulfilled successfully`

### Test 7: Webhook Sending
```bash
# After order is fulfilled, webhook should be sent
```
- [ ] Check `t2mobile_webhook_logs` table for ORDER_FULFILLED event
- [ ] Webhook log shows status: SENT
- [ ] Response includes T2Mobile's acknowledgment
- [ ] httpStatusCode: 200 or similar

### Test 8: Error Handling
```bash
# Send order without required field
curl -X POST http://localhost:4000/t2mobile/fulfilment \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Idempotency-Key: test-error-001" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "T2M_ERROR_001"
    # Missing other required fields
  }'
```
- [ ] Response Status: 400 Bad Request
- [ ] Response includes clear error message
- [ ] errorCode: INVALID_PAYLOAD
- [ ] No order created in database

### Test 9: Rate Limiting
```bash
# Send 101 requests rapidly
for i in {1..101}; do
  curl -X GET http://localhost:4000/t2mobile/products \
    -H "Authorization: Bearer YOUR_API_KEY"
done
```
- [ ] First 100 requests succeed (200 OK)
- [ ] 101st request returns 429 Too Many Requests
- [ ] Rate limit resets after 1 minute

### Test 10: Health Check
```bash
curl -X GET http://localhost:4000/t2mobile/health
```
- [ ] Response Status: 200 OK
- [ ] Response includes status: healthy
- [ ] Response includes service: t2mobile-integration
- [ ] Response includes timestamp

---

## Database Verification ✓

### Orders Table
```sql
SELECT COUNT(*) as total_orders FROM t2mobile_orders;
SELECT status, COUNT(*) FROM t2mobile_orders GROUP BY status;
SELECT * FROM t2mobile_orders WHERE status = 'FULFILLED' LIMIT 1;
```
- [ ] Table exists and has test data
- [ ] Status values present: PENDING, PROCESSING, FULFILLED expected
- [ ] idempotencyKey is unique per order
- [ ] All timestamp fields auto-populated

### Fulfillments Table
```sql
SELECT COUNT(*) FROM t2mobile_fulfillments;
SELECT * FROM t2mobile_fulfillments LIMIT 1;
```
- [ ] Table exists after order processing
- [ ] Contains fulfillment records for processed orders
- [ ] expiryDate calculated correctly
- [ ] status field set to ACTIVE for successful orders

### Webhook Logs Table
```sql
SELECT eventType, status, COUNT(*) FROM t2mobile_webhook_logs 
GROUP BY eventType, status;
```
- [ ] Table exists after order processing
- [ ] Contains ORDER_FULFILLED events
- [ ] Webhook status is SENT (not FAILED or PENDING)
- [ ] Payload and response stored correctly

---

## Job Queue Verification ✓

### BullMQ Queues
```bash
# Check queue names exist
redis-cli KEYS "bull:*"
```
- [ ] Queue exists: `bull:t2mobile-orders:*`
- [ ] Queue exists: `bull:webhook-retries:*`
- [ ] Completed jobs are visible
- [ ] Failed jobs (if any) are logged

### Job Processing
- [ ] Jobs complete successfully in < 30 seconds
- [ ] Failed jobs log appropriate errors
- [ ] Retry mechanism works (if needed)

---

## Scheduler Verification ✓

### Cron Tasks
```bash
# Check logs for scheduler messages
tail -f logs/app.log | grep "\[Scheduler\]"
```
- [ ] App startup logs: `Starting T2Mobile scheduler...`
- [ ] App startup logs: All three cron jobs initialized
- [ ] Every 5 minutes: `[Scheduler] Running webhook retry job...`
- [ ] Daily at 2 AM: `[Scheduler] Running expiry reminder job...`
- [ ] Daily at 3 AM: `[Scheduler] Running renewal check job...`

---

## Integration with Zoho ✓

### Zoho Token Generation
- [ ] Test access to Zoho API endpoint
- [ ] OAuth token obtainable with credentials
- [ ] Sales Order creation works
- [ ] Product lookup works

### Zoho Sales Order Creation
```sql
-- Check Zoho integration via order processing
SELECT zohoSalesOrderId FROM t2mobile_orders 
WHERE status = 'FULFILLED' LIMIT 1;
```
- [ ] zohoSalesOrderId populated for fulfilled orders
- [ ] Sales Order visible in Zoho Inventory
- [ ] Order linked to correct customer
- [ ] Amount and items correct

---

## Logging & Monitoring ✓

### Application Logs
- [ ] Logs created: `npm start` produces console output
- [ ] Log levels working: info, error, warning
- [ ] No sensitive data in logs (API keys masked)
- [ ] Timestamps accurate

### Error Logging
- [ ] API errors logged with context
- [ ] Job failures logged with stack traces
- [ ] Webhook failures logged with retry info
- [ ] Database errors logged appropriately

### Performance Monitoring
- [ ] Response times < 5 seconds for synchronous endpoints
- [ ] Job processing < 30 seconds average
- [ ] No memory leaks (process memory stable)
- [ ] Database queries optimized (using indexes)

---

## Security Verification ✓

### API Security
- [ ] API key validation working on all endpoints
- [ ] No API key in logs or error messages
- [ ] CORS configured properly (if needed)
- [ ] HTTPS enforced in production config

### Webhook Security
- [ ] Webhook signature generated correctly (HMAC-SHA256)
- [ ] Webhook secret not exposed
- [ ] Signature verification logic present (future incoming webhooks)

### Database Security
- [ ] Database password in environment variable (not in code)
- [ ] Database user limited to required tables
- [ ] Connection uses SSL (if configured)
- [ ] Backup encrypted

### Secret Management
- [ ] All secrets in environment variables
- [ ] No secrets in version control
- [ ] Secrets rotated regularly per policy
- [ ] Access logs for credential usage

---

## Production Readiness ✓

### Performance
- [ ] Application starts without errors
- [ ] All endpoints respond within SLA
- [ ] Job queue processes efficiently
- [ ] Database queries optimized

### Reliability
- [ ] Redis failover configured (if needed)
- [ ] Database failover configured (if needed)
- [ ] Error recovery working
- [ ] Retry logic functional

### Scalability
- [ ] Horizontal scaling plan documented
- [ ] Load balancer configured (if distributed)
- [ ] Job queue can handle peak volume
- [ ] Database can handle peak queries

### Monitoring
- [ ] Application metrics collected
- [ ] Alerts configured for failures
- [ ] Logs aggregated (Cloudwatch, DataDog, etc.)
- [ ] Dashboard created for key metrics

---

## Deployment Steps ✓

- [ ] Production environment prepared
- [ ] SSL/TLS certificates installed
- [ ] Environment variables deployed
- [ ] Database migrations run
- [ ] Redis running and accessible
- [ ] Application started: `npm start`
- [ ] Health check passes
- [ ] Smoke tests successful
- [ ] Monitoring active
- [ ] Rollback plan ready

---

## Post-Deployment Verification ✓

- [ ] Application running on production server
- [ ] All endpoints responding
- [ ] Orders processing successfully
- [ ] Webhooks being sent to T2Mobile
- [ ] Logs being collected
- [ ] Monitoring alerts working
- [ ] Team notified of deployment
- [ ] T2Mobile notified of readiness

---

## Sign-Off

- [ ] **Developer:** __________________ Date: ___________
- [ ] **QA/Tester:** _________________ Date: ___________
- [ ] **DevOps:** __________________ Date: ___________
- [ ] **Product Owner:** ______________ Date: ___________

---

## Troubleshooting Reference

If any check fails, refer to:
1. **SETUP_GUIDE.md** - Detailed setup instructions
2. **IMPLEMENTATION_SUMMARY.md** - Architecture details
3. **QUICK_REFERENCE.md** - API and code reference
4. **T2MOBILE_INTEGRATION_WORKFLOW.md** - Workflow specifications

---

## Support Contacts

- **T2Mobile Technical:** kenneth.epiah@t2mobile.com.ng
- **IconTech Lead:** +2347035599433
- **Escalation:** [Your support channel]

---

**All checks passed? Ready for production! 🚀**

