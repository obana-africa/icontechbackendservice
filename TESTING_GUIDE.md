# 🧪 T2Mobile Integration - Complete Testing Guide

## Quick Start: Test Environment Setup

### Prerequisites
```bash
# Terminal 1: Start Redis
redis-server

# Terminal 2: Start IconTech App
npm start
# Should see: "T2Mobile integration initialized"
# Should see: "Server running on port 4000"
```

### Verify Health
```bash
curl http://localhost:4000/t2mobile/health
# Expected: 200 OK with timestamp
```

---

## 🔐 Test API Key Setup

### Mock T2Mobile as External Service

**Create a test API key** (for now):
```bash
# In your .env.local file, use this during testing:
T2MOBILE_API_KEY=test-api-key-12345
T2MOBILE_WEBHOOK_SECRET=test-webhook-secret-67890
T2MOBILE_WEBHOOK_URL=http://localhost:3001/webhooks

# Or generate from command line:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Save credentials for your test session:**
```bash
# These are what you'll use in all curl requests below
API_KEY="test-api-key-12345"
WEBHOOK_SECRET="test-webhook-secret-67890"
BASE_URL="http://localhost:4000"
```

---

## ✅ Test Scenario 1: Get Product Catalogue

### What This Tests
- API authentication
- Bearer token validation
- Product response formatting
- Rate limiting

### Request
```bash
curl -X GET http://localhost:4000/t2mile/products \
  -H "Authorization: Bearer test-api-key-12345" \
  -H "Content-Type: application/json"
```

### Expected Response (200 OK)
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "partnerId": "ICONTECH001",
    "products": [
      {
        "productId": "ZOHO_CRM_STD",
        "productName": "Zoho CRM - Standard",
        "description": "Standard edition CRM",
        "tenures": ["1_MONTH", "3_MONTHS", "6_MONTHS", "12_MONTHS"]
      },
      {
        "productId": "ZOHO_BOOKS_PRO",
        "productName": "Zoho Books - Professional",
        "description": "Professional accounting software",
        "tenures": ["1_MONTH", "3_MONTHS", "6_MONTHS", "12_MONTHS"]
      }
    ]
  },
  "timestamp": "2026-02-22T10:30:45.123Z"
}
```

### Test Variations

**❌ Invalid API Key**
```bash
curl -X GET http://localhost:4000/t2mobile/products \
  -H "Authorization: Bearer wrong-key"

# Expected: 401 Unauthorized
# Response: {"success": false, "errorCode": "INVALID_API_KEY"}
```

**❌ Missing Authorization Header**
```bash
curl -X GET http://localhost:4000/t2mobile/products

# Expected: 401 Unauthorized
# Response: {"success": false, "errorCode": "MISSING_API_KEY"}
```

**📊 Rate Limiting Test** (make 101+ requests quickly)
```bash
for i in {1..105}; do
  curl -X GET http://localhost:4000/t2mobile/products \
    -H "Authorization: Bearer test-api-key-12345" &
done

# Expected after 100 requests:
# 429 Too Many Requests
# Response: {"success": false, "errorCode": "RATE_LIMIT_EXCEEDED"}
```

### What to Check in Database
```sql
-- After calling /products, nothing should be created
-- This endpoint is read-only
SELECT COUNT(*) FROM t2mobile_orders; -- Should still be 0
```

---

## ✅ Test Scenario 2: Submit Order (Main Test)

### What This Tests
- Order creation
- Async job queuing
- Database persistence
- Idempotency key handling
- 202 Accepted response

### Request 1: First Order Submission
```bash
curl -X POST http://localhost:4000/t2mobile/fulfilment \
  -H "Authorization: Bearer test-api-key-12345" \
  -H "Idempotency-Key: order-001-unique-key" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "T2M_ORDER_001",
    "productId": "ZOHO_CRM_STD",
    "customerId": "T2M_CUST_001",
    "customerName": "John Doe",
    "customerEmail": "john.doe@example.com",
    "customerPhone": "08012345678",
    "tenure": "12_MONTHS"
  }'
```

### Expected Response (202 Accepted)
```json
{
  "success": true,
  "statusCode": 202,
  "data": {
    "orderId": "T2M_ORDER_001",
    "status": "PROCESSING",
    "activationReference": "ZOHO_CRM_STD_T2M_ORDER_001",
    "jobId": "job-uuid-here",
    "message": "Order received and queued for processing"
  },
  "timestamp": "2026-02-22T10:31:00.000Z"
}
```

### What Happens Behind Scenes
```
1. API validates request payload
2. Checks for duplicate (idempotency key)
3. Creates order record: status = PENDING
4. Queues async job in BullMQ
5. Returns 202 immediately (< 100ms)
6. Background job processes order asynchronously
```

### Check in Database
```sql
-- Immediately after API call:
SELECT * FROM t2mobile_orders WHERE orderId = 'T2M_ORDER_001';

-- Expected columns:
-- id: 1
-- orderId: T2M_ORDER_001
-- customerId: T2M_CUST_001
-- status: PENDING (will become PROCESSING then FULFILLED)
-- idempotencyKey: order-001-unique-key
-- createdAt: 2026-02-22 10:31:00
```

### Check Job Queue Status (In Real-Time)
```bash
# From your Node terminal, you should see logs like:
# [T2Mobile Order Job] Processing order: T2M_ORDER_001
# [T2Mobile Order Job] Step 1/5: Validate order
# [T2Mobile Order Job] Step 2/5: Get Zoho token
# [T2Mobile Order Job] Step 3/5: Create Zoho Sales Order
# [T2Mobile Order Job] Step 4/5: Provision license
# [T2Mobile Order Job] Step 5/5: Send webhook
```

### Verify Job Processing
```bash
# In Redis CLI:
redis-cli
> LLEN "bull:t2mobile-orders:1"    # Queue depth
> LLEN "bull:t2mobile-orders:2"    # Active jobs
> LLEN "bull:t2mobile-orders:3"    # Completed jobs
```

---

## ✅ Test Scenario 3: Idempotency (Duplicate Prevention)

### What This Tests
- Duplicate detection
- Idempotency key enforcement
- Single order guarantee

### Request 1: Original Order
```bash
curl -X POST http://localhost:4000/t2mobile/fulfilment \
  -H "Authorization: Bearer test-api-key-12345" \
  -H "Idempotency-Key: A1B2C3D4E5F6" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "T2M_ORDER_002",
    "productId": "ZOHO_BOOKS_PRO",
    "customerId": "T2M_CUST_002",
    "customerName": "Jane Smith",
    "customerEmail": "jane@example.com",
    "customerPhone": "08087654321",
    "tenure": "6_MONTHS"
  }'

# Response: 202 PROCESSING
# Note the Idempotency-Key: A1B2C3D4E5F6
```

### Request 2: Exact Same Request (Same Idempotency-Key)
```bash
curl -X POST http://localhost:4000/t2mobile/fulfilment \
  -H "Authorization: Bearer test-api-key-12345" \
  -H "Idempotency-Key: A1B2C3D4E5F6" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "T2M_ORDER_002",
    "productId": "ZOHO_BOOKS_PRO",
    "customerId": "T2M_CUST_002",
    "customerName": "Jane Smith",
    "customerEmail": "jane@example.com",
    "customerPhone": "08087654321",
    "tenure": "6_MONTHS"
  }'

# Expected: 200 OK (not 202!)
# Response: {"success": true, "isDuplicate": true, "data": {...original order...}}
```

### Expected Response (200 OK on Duplicate)
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "orderId": "T2M_ORDER_002",
    "isDuplicate": true,
    "message": "Order already processed with this idempotency key",
    "previousStatus": "PROCESSING"
  }
}
```

### Verify in Database
```sql
-- Only ONE order should exist
SELECT COUNT(*) FROM t2mobile_orders WHERE idempotencyKey = 'A1B2C3D4E5F6';
-- Expected: 1 (not 2)

-- Only ONE job should have been queued
SELECT COUNT(*) FROM bull:t2mobile-orders:* WHERE data LIKE '%T2M_ORDER_002%';
-- Expected: 1 job total
```

### Why Idempotency Matters
```
Scenario: T2Mobile's network dies after IconTech responds with 202
Problem: T2Mobile doesn't receive the response
Solution: T2Mobile retries with same Idempotency-Key
Result: IconTech returns existing order (no duplicate created)
```

---

## ✅ Test Scenario 4: Invalid Payload

### What This Tests
- Input validation
- Error messages
- Proper error codes

### Missing Field - Missing customerEmail
```bash
curl -X POST http://localhost:4000/t2mobile/fulfilment \
  -H "Authorization: Bearer test-api-key-12345" \
  -H "Idempotency-Key: test-key-001" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "T2M_ORDER_003",
    "productId": "ZOHO_CRM_STD",
    "customerId": "T2M_CUST_003",
    "customerName": "Tom Wilson"
    "customerPhone": "08012345678",
    "tenure": "12_MONTHS"
  }'

# Expected: 400 Bad Request
# Response:
# {
#   "success": false,
#   "errorCode": "INVALID_PAYLOAD",
#   "message": "Missing required field: customerEmail"
# }
```

### Invalid Email Format
```bash
curl -X POST http://localhost:4000/t2mobile/fulfilment \
  -H "Authorization: Bearer test-api-key-12345" \
  -H "Idempotency-Key: test-key-002" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "T2M_ORDER_004",
    "productId": "ZOHO_CRM_STD",
    "customerId": "T2M_CUST_004",
    "customerName": "Bob Johnson",
    "customerEmail": "not-an-email",
    "customerPhone": "08012345678",
    "tenure": "12_MONTHS"
  }'

# Expected: 400 Bad Request
# Response:
# {
#   "success": false,
#   "errorCode": "INVALID_PAYLOAD",
#   "message": "Invalid email format"
# }
```

### Invalid Tenure Value
```bash
curl -X POST http://localhost:4000/t2mobile/fulfilment \
  -H "Authorization: Bearer test-api-key-12345" \
  -H "Idempotency-Key: test-key-003" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "T2M_ORDER_005",
    "productId": "ZOHO_CRM_STD",
    "customerId": "T2M_CUST_005",
    "customerName": "Alice Brown",
    "customerEmail": "alice@example.com",
    "customerPhone": "08012345678",
    "tenure": "INVALID_TENURE"
  }'

# Expected: 400 Bad Request
# Response:
# {
#   "success": false,
#   "errorCode": "INVALID_PAYLOAD",
#   "message": "Invalid tenure. Allowed values: 1_MONTH, 3_MONTHS, 6_MONTHS, 12_MONTHS"
# }
```

### Invalid Product ID
```bash
curl -X POST http://localhost:4000/t2mobile/fulfilment \
  -H "Authorization: Bearer test-api-key-12345" \
  -H "Idempotency-Key: test-key-004" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "T2M_ORDER_006",
    "productId": "UNKNOWN_PRODUCT",
    "customerId": "T2M_CUST_006",
    "customerName": "Charlie Davis",
    "customerEmail": "charlie@example.com",
    "customerPhone": "08012345678",
    "tenure": "12_MONTHS"
  }'

# Expected: 400 Bad Request
# Response:
# {
#   "success": false,
#   "errorCode": "INVALID_PAYLOAD",
#   "message": "Product not found: UNKNOWN_PRODUCT"
# }
```

---

## ✅ Test Scenario 5: Check Order Status

### What This Tests
- Status retrieval
- Order lookup
- Status transitions

### Request: Get Order Status
```bash
curl -X GET http://localhost:4000/t2mobile/orders/T2M_ORDER_001 \
  -H "Authorization: Bearer test-api-key-12345"
```

### Expected Response (200 OK)
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "orderId": "T2M_ORDER_001",
    "customerId": "T2M_CUST_001",
    "customerName": "John Doe",
    "status": "FULFILLED",
    "productId": "ZOHO_CRM_STD",
    "tenure": "12_MONTHS",
    "activationReference": "ZOHO_CRM_STD_T2M_ORDER_001",
    "zohoSalesOrderId": "SO-2026-0001",
    "createdAt": "2026-02-22T10:31:00.000Z",
    "updatedAt": "2026-02-22T10:31:45.000Z"
  }
}
```

### Status Transitions Over Time
```
Timeline:
T+0 sec:  status = PENDING (order created)
T+2 sec:  status = PROCESSING (job started)
T+5 sec:  status = FULFILLED (Zoho SO created, license provisioned)

If something goes wrong:
          status = FAILED (error during processing)
```

### Check Non-Existent Order
```bash
curl -X GET http://localhost:4000/t2mobile/orders/NONEXISTENT_ORDER \
  -H "Authorization: Bearer test-api-key-12345"

# Expected: 404 Not Found
# Response:
# {
#   "success": false,
#   "errorCode": "ORDER_NOT_FOUND",
#   "message": "Order not found: NONEXISTENT_ORDER"
# }
```

---

## 📡 Test Scenario 6: Webhook Delivery Simulation

### What This Tests
- Webhook payload structure
- HMAC signature validation
- Webhook retry logic

### Setup Mock Webhook Receiver (Node.js)

**Create: test-webhook-receiver.js**
```javascript
const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const WEBHOOK_SECRET = 'test-webhook-secret-67890';

app.post('/webhooks', (req, res) => {
  console.log('\n=== WEBHOOK RECEIVED ===');
  console.log('Headers:', req.headers);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  
  // Verify HMAC signature
  const signature = req.headers['x-signature'];
  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  
  const isValid = signature === expectedSignature;
  console.log('Signature Valid:', isValid);
  console.log('Expected:', expectedSignature);
  console.log('Received:', signature);
  
  // Send success
  res.json({ received: true, signatureValid: isValid });
});

app.listen(3001, () => {
  console.log('Webhook receiver listening on :3001');
  console.log('Ready to receive webhooks at POST /webhooks');
});
```

**Run the receiver:**
```bash
# Terminal 3:
node test-webhook-receiver.js
# Output: Webhook receiver listening on :3001
```

**Update environment variable:**
```bash
# In your .env.local:
T2MOBILE_WEBHOOK_URL=http://localhost:3001/webhooks
```

### Submit an Order and Watch Webhooks

```bash
# Terminal 1: icontech app should send webhooks to :3001

# Terminal 3: Watch webhook receiver
# You should see:
# === WEBHOOK RECEIVED ===
# Headers: { x-signature: 'abc123...', x-event-id: '...', x-timestamp: '...' }
# Body: {
#   eventType: "ORDER_FULFILLED",
#   orderId: "T2M_ORDER_001",
#   activationReference: "ZOHO_CRM_STD_T2M_ORDER_001",
#   customerId: "T2M_CUST_001",
#   status: "FULFILLED",
#   zohoSalesOrderId: "SO-2026-0001",
#   timestamp: "2026-02-22T10:31:45.000Z"
# }
# Signature Valid: true
```

### Webhook Payload Types

**1. ORDER_FULFILLED**
```json
{
  "eventType": "ORDER_FULFILLED",
  "orderId": "T2M_ORDER_001",
  "activationReference": "ZOHO_CRM_STD_T2M_ORDER_001",
  "customerId": "T2M_CUST_001",
  "customerEmail": "john.doe@example.com",
  "productId": "ZOHO_CRM_STD",
  "status": "FULFILLED",
  "zohoSalesOrderId": "SO-2026-0001",
  "activationDate": "2026-02-22T10:31:45.000Z",
  "expiryDate": "2027-02-22",
  "timestamp": "2026-02-22T10:31:45.000Z"
}
```

**2. ORDER_FAILED**
```json
{
  "eventType": "ORDER_FAILED",
  "orderId": "T2M_ORDER_002",
  "activationReference": "ZOHO_BOOKS_PRO_T2M_ORDER_002",
  "customerId": "T2M_CUST_002",
  "customerEmail": "jane@example.com",
  "status": "FAILED",
  "errorCode": "ZOHO_API_ERROR",
  "errorMessage": "Failed to create Sales Order in Zoho",
  "timestamp": "2026-02-22T10:32:00.000Z"
}
```

**3. EXPIRY_REMINDER** (sent daily at 2 AM)
```json
{
  "eventType": "EXPIRY_REMINDER",
  "activationReference": "ZOHO_CRM_STD_T2M_ORDER_001",
  "customerId": "T2M_CUST_001",
  "customerEmail": "john.doe@example.com",
  "productId": "ZOHO_CRM_STD",
  "expiryDate": "2026-02-28",
  "daysUntilExpiry": 6,
  "amount": 15000,
  "currency": "NGN",
  "timestamp": "2026-02-23T02:00:00.000Z"
}
```

### Test Webhook Retry Logic (Advanced)

**Simulate webhook failure:**
```bash
# Stop the webhook receiver (Ctrl+C in Terminal 3)
# Then submit an order - webhook will fail

# Wait 5 minutes - scheduler will retry
# Or manually trigger in Node:

const JobHelper = require('./src/helpers/jobHelper');
const WebhookHelper = require('./src/helpers/webhookHelper');

// Manual retry:
const failed = await WebhookHelper.retryFailedWebhooks();
console.log('Retried:', failed);
```

**Verify retry in database:**
```sql
SELECT * FROM t2mobile_webhook_logs 
WHERE status IN ('FAILED', 'RETRYING')
ORDER BY nextRetryAt ASC;

-- You should see:
-- id: 1
-- eventType: ORDER_FULFILLED
-- status: FAILED (or RETRYING)
-- retries: 1 (increments each retry)
-- nextRetryAt: 2026-02-22 10:36:00 (5 min later)
-- lastError: Connection refused
```

---

## 🔄 Complete End-to-End Test Workflow

### This tests the ENTIRE flow from order submission to webhook delivery

**Step 1: Start Services**
```bash
# Terminal 1: Redis
redis-server

# Terminal 2: IconTech App
npm start

# Terminal 3: Webhook Receiver
node test-webhook-receiver.js

# Wait until all 3 are running successfully
```

**Step 2: Set Variables**
```bash
export API_KEY="test-api-key-12345"
export BASE_URL="http://localhost:4000"
IDEM_KEY="e2e-test-$(date +%s)"
```

**Step 3: Check Products**
```bash
curl -X GET $BASE_URL/t2mobile/products \
  -H "Authorization: Bearer $API_KEY" | jq '.'
```

**Step 4: Submit Order**
```bash
curl -X POST $BASE_URL/t2mobile/fulfilment \
  -H "Authorization: Bearer $API_KEY" \
  -H "Idempotency-Key: $IDEM_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "E2E_TEST_001",
    "productId": "ZOHO_CRM_STD",
    "customerId": "E2E_CUST_001",
    "customerName": "E2E Tester",
    "customerEmail": "e2e@test.local",
    "customerPhone": "08012345678",
    "tenure": "12_MONTHS"
  }' | jq '.data.activationReference'
  
# Save the activationReference
ACTIVATION_REF="ZOHO_CRM_STD_E2E_TEST_001"
```

**Step 5: Wait for Processing**
```bash
sleep 3

# Check status multiple times
for i in 1 2 3; do
  echo "=== Check $i ==="
  curl -X GET $BASE_URL/t2mobile/orders/E2E_TEST_001 \
    -H "Authorization: Bearer $API_KEY" | jq '.data | {status, zohoSalesOrderId}'
  sleep 2
done

# Expected progression:
# Check 1: status = PROCESSING
# Check 2: status = PROCESSING
# Check 3: status = FULFILLED
```

**Step 6: Verify Database**
```bash
# In MySQL:
SELECT * FROM t2mobile_orders WHERE orderId = 'E2E_TEST_001';
SELECT * FROM t2mobile_fulfillments WHERE activationReference = 'ZOHO_CRM_STD_E2E_TEST_001';
SELECT * FROM t2mobile_webhook_logs WHERE eventType = 'ORDER_FULFILLED';
```

**Step 7: Verify Webhook Delivery**
```bash
# Check Terminal 3 output from webhook receiver:
# === WEBHOOK RECEIVED ===
# Signature Valid: true
# eventType: ORDER_FULFILLED
# activationReference: ZOHO_CRM_STD_E2E_TEST_001
```

**Step 8: Test Duplicate Prevention**
```bash
curl -X POST $BASE_URL/t2mobile/fulfilment \
  -H "Authorization: Bearer $API_KEY" \
  -H "Idempotency-Key: $IDEM_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "E2E_TEST_001",
    "productId": "ZOHO_CRM_STD",
    "customerId": "E2E_CUST_001",
    "customerName": "E2E Tester",
    "customerEmail": "e2e@test.local",
    "customerPhone": "08012345678",
    "tenure": "12_MONTHS"
  }' | jq '.data'

# Expected: isDuplicate = true, statusCode = 200 (not 202)
```

### Expected Console Output Flow

```
[T2Mobile] GET /products - API Key validated
[T2Mobile] POST /fulfilment - Order created, job queued
[T2Mobile] Order Job - Processing order E2E_TEST_001
[T2Mobile] Order Job - Step 1/5: Validate order ✓
[T2Mobile] Order Job - Step 2/5: Get Zoho token ✓
[T2Mobile] Order Job - Step 3/5: Create Zoho Sales Order ✓
[T2Mobile] Order Job - Step 4/5: Provision license ✓
[T2Mobile] Order Job - Step 5/5: Send webhook ✓
[Webhook] Sending ORDER_FULFILLED to http://localhost:3001/webhooks
[Webhook] Response 200 OK from T2Mobile
[API] GET /orders/E2E_TEST_001 - Returning status FULFILLED
[API] POST /fulfilment - Duplicate order detected (same Idempotency-Key)
```

---

## 📊 Performance Testing

### Load Test: Rapid Order Submissions

```bash
#!/bin/bash
# save as: test-load.sh

API_KEY="test-api-key-12345"
BASE_URL="http://localhost:4000"
NUM_ORDERS=10

echo "Submitting $NUM_ORDERS orders..."

for i in $(seq 1 $NUM_ORDERS); do
  curl -s -X POST $BASE_URL/t2mobile/fulfilment \
    -H "Authorization: Bearer $API_KEY" \
    -H "Idempotency-Key: load-test-$i" \
    -H "Content-Type: application/json" \
    -d "{
      \"orderId\": \"LOAD_TEST_$i\",
      \"productId\": \"ZOHO_CRM_STD\",
      \"customerId\": \"LOAD_CUST_$i\",
      \"customerName\": \"Load Test User $i\",
      \"customerEmail\": \"loadtest$i@test.local\",
      \"customerPhone\": \"0801234567$i\",
      \"tenure\": \"12_MONTHS\"
    }" &
done

wait
echo "All orders submitted"

# Check queue
echo "\n=== Queue Status ==="
redis-cli LLEN "bull:t2mobile-orders:1"
redis-cli LLEN "bull:t2mobile-orders:2"
redis-cli LLEN "bull:t2mobile-orders:3"
```

**Run it:**
```bash
bash test-load.sh

# Expected:
# Submitting 10 orders...
# All orders submitted
# 
# === Queue Status ===
# 10 (waiting)
# 0-2 (active, processing)
# 0-10 (completed)
```

### Check Queue Processing Speed

```bash
# In Redis CLI, watch processing in real-time:
redis-cli LLEN "bull:t2mobile-orders:3"  # Completed count
# Run every 2 seconds
watch -n 2 'redis-cli LLEN "bull:t2mobile-orders:3"'

# With 5 concurrent workers, should complete ~5 orders every 10 seconds
```

---

## 🐛 Debugging & Troubleshooting

### Check Application Logs

```bash
# Terminal 2 (IconTech app) should show:
# [T2Mobile] POST /fulfilment - Validating payload
# [T2Mobile] Order Job - Processing order...
# [T2Mobile] Webhook - Sending ORDER_FULFILLED...

# If you see errors:
# [ERROR] API Key validation failed
# [ERROR] Order Job failed: TIMEOUT
# [ERROR] Webhook delivery failed: Connection refused
```

### Debug Database State

```bash
# Check orders
SELECT id, orderId, status, createdAt, updatedAt 
FROM t2mobile_orders 
ORDER BY createdAt DESC LIMIT 5;

# Check fulfillments
SELECT id, orderId, status, expiryDate 
FROM t2mobile_fulfillments 
ORDER BY createdAt DESC LIMIT 5;

# Check webhooks
SELECT eventType, status, retries, nextRetryAt 
FROM t2mobile_webhook_logs 
WHERE status IN ('FAILED', 'RETRYING')
ORDER BY nextRetryAt ASC;

# Check for errors
SELECT * FROM t2mobile_orders WHERE status = 'FAILED';
SELECT errorMessage FROM t2mobile_orders WHERE errorMessage IS NOT NULL;
```

### Debug Job Queue

```bash
# In Node REPL or test script:
const JobHelper = require('./src/helpers/jobHelper');

// Get queue stats
const stats = await JobHelper.getQueueStats('t2mobile-orders');
console.log(stats);
// {
//   waiting: 0,
//   active: 2,
//   completed: 45,
//   failed: 0
// }

// Get specific job status
const status = await JobHelper.getJobStatus('t2mobile-orders', 'job-id-123');
console.log(status);
// {
//   state: 'completed',
//   progress: 100,
//   attempts: 1
// }
```

### Clear Failed Jobs

```bash
# If jobs are stuck in failed state:
const JobHelper = require('./src/helpers/jobHelper');

// Clear them
await JobHelper.clearFailedJobs('t2mobile-orders');
console.log('Failed jobs cleared');

// Or retry manually
await JobHelper.retryJob('t2mobile-orders', 'job-id');
console.log('Job retried');
```

---

## 📋 Testing Checklist

Use this checklist to validate complete functionality:

### Authentication & Authorization
- [ ] Valid API key returns 200
- [ ] Invalid API key returns 401
- [ ] Missing API key returns 401
- [ ] Rate limiting kicks in at 100 req/min

### Product Catalog
- [ ] GET /products with valid key returns 200
- [ ] Response includes all 2 products
- [ ] Each product has correct tenures
- [ ] Response is cached appropriately

### Order Creation
- [ ] POST /fulfilment with valid data returns 202
- [ ] Order created in database with PENDING status
- [ ] Job is queued for processing
- [ ] Response includes activationReference
- [ ] Response includes jobId

### Idempotency
- [ ] First request returns 202 PROCESSING
- [ ] Second request (same Idempotency-Key) returns 200 OK
- [ ] isDuplicate flag present on second request
- [ ] Only one order in database
- [ ] Only one job queued

### Validation
- [ ] Missing field returns 400 INVALID_PAYLOAD
- [ ] Invalid email format returns 400
- [ ] Invalid tenure returns 400
- [ ] Invalid product returns 400
- [ ] Empty request body returns 400

### Order Status
- [ ] GET /orders/{id} with valid order returns 200
- [ ] Status transitions correctly (PENDING → PROCESSING → FULFILLED)
- [ ] Non-existent order returns 404
- [ ] Response includes all order details

### Job Processing
- [ ] Job starts processing within 2 seconds
- [ ] All 5 job steps complete successfully
- [ ] Order status changes to FULFILLED
- [ ] Job progress is tracked (25%, 50%, 75%, 100%)

### Webhook Delivery
- [ ] Webhook sent when order is fulfilled
- [ ] Webhook payload has correct structure
- [ ] HMAC signature is valid
- [ ] Webhook includes correct eventType
- [ ] Failed webhooks are retried

### Error Handling
- [ ] Failed orders set status to FAILED
- [ ] Error message is captured
- [ ] FAILED status webhook is sent
- [ ] Errors don't crash the application

### Scheduler & Jobs
- [ ] Application starts without errors
- [ ] Scheduler initializes all 3 cron jobs
- [ ] Webhook retry job runs every 5 minutes
- [ ] Expiry reminder job runs daily at 2 AM
- [ ] Jobs can be stopped and restarted

### Database
- [ ] All 3 tables created correctly
- [ ] Indexes created and working
- [ ] Foreign key relationships enforced
- [ ] Auto-timestamps (createdAt, updatedAt) working
- [ ] Enum values enforced

### Performance
- [ ] API response time < 100ms (202 response)
- [ ] 10 orders process concurrently
- [ ] Queue depth increases/decreases correctly
- [ ] No memory leaks after 1000 orders

### Security
- [ ] API keys never logged
- [ ] HMAC signature validated on webhooks
- [ ] Secrets stored in environment variables only
- [ ] Rate limiting prevents abuse
- [ ] Input validation prevents injection attacks

---

## 🎯 Quick Test Commands

```bash
# Copy-paste for quick testing

# 1. Products
curl http://localhost:4000/t2mobile/products -H "Authorization: Bearer test-api-key-12345"

# 2. Create Order
curl -X POST http://localhost:4000/t2mobile/fulfilment \
  -H "Authorization: Bearer test-api-key-12345" \
  -H "Idempotency-Key: quick-test-$(date +%s)" \
  -H "Content-Type: application/json" \
  -d '{"orderId":"Q_$(date +%s)","productId":"ZOHO_CRM_STD","customerId":"Q_CUST","customerName":"Quick Test","customerEmail":"quick@test.local","customerPhone":"08012345678","tenure":"12_MONTHS"}'

# 3. Order Status
curl http://localhost:4000/t2mobile/orders/Q_<orderId> -H "Authorization: Bearer test-api-key-12345"

# 4. Health Check
curl http://localhost:4000/t2mobile/health

# 5. Watch Webhook Receiver
tail -f webhook-receiver-output.log
```

---

## 📞 Common Issues During Testing

| Issue | Cause | Solution |
|-------|-------|----------|
| **Connection refused** | Redis not running | `redis-server` in new terminal |
| **EADDRINUSE :4000** | Port already in use | `lsof -i :4000` then `kill -9 PID` |
| **Job not processing** | BullMQ config error | Check Redis connection, check `REDIS_HOST` |
| **Webhook not sent** | Webhook URL unreachable | Check `T2MOBILE_WEBHOOK_URL` in .env |
| **Signature mismatch** | Secret mismatch | Ensure same secret in app and receiver |
| **Database error** | DB not running | Verify MySQL/PostgreSQL running |
| **Duplicate detection broken** | Key collision | Check idempotencyKey uniqueness |

---

## 🎁 Test Data Aliases

Use these for quick copy-paste testing:

```bash
# Products
PRODUCT_1="ZOHO_CRM_STD"
PRODUCT_2="ZOHO_BOOKS_PRO"

# Tenures
TENURE_1M="1_MONTH"
TENURE_3M="3_MONTHS"
TENURE_6M="6_MONTHS"
TENURE_12M="12_MONTHS"

# Test Customers
CUST_1="TEST_CUST_001"
CUST_2="TEST_CUST_002"

# Email Templates
EMAIL_1="test1@t2mobile.local"
EMAIL_2="test2@t2mobile.local"

# Phones
PHONE_1="08012345678"
PHONE_2="08087654321"
```

---

## ✅ Next Steps After Testing

Once all tests pass:

1. **Document Results**: Save curl commands and responses
2. **Record Performance**: Note API response times, job processing speeds
3. **List Issues Found**: Document any bugs or unexpected behavior
4. **Integration**: Move to staging environment
5. **Production**: Follow DEPLOYMENT_CHECKLIST.md

---

**Test Environment Ready!** ✨

Start with: **Test Scenario 1** → **Test Scenario 2** → **Complete E2E Workflow**

