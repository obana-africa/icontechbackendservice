# T2Mobile Integration - Implementation Workflow

## Project Overview
Integrate IconTech with T2Mobile subscription portal to expose product APIs, receive orders, and send status webhooks.

---

## Phase 1: Architecture & Planning

### A. Data Model Design
```
Tables to Create/Modify:
1. t2mobile_orders
   - id (primary key)
   - orderId (T2M order ID) - UNIQUE
   - customerId (T2M customer ID)
   - customerName
   - customerEmail
   - customerPhone
   - productId (Zoho product ID)
   - tenure (12_MONTHS, 1_MONTH, etc)
   - status (PENDING, PROCESSING, FULFILLED, FAILED)
   - zohoSalesOrderId (reference to Zoho Sales Order)
   - activationReference (Zoho license/fulfillment ID)
   - idempotencyKey - UNIQUE
   - createdAt
   - updatedAt

2. t2mobile_fulfilments
   - id (primary key)
   - orderId (foreign key to t2mobile_orders)
   - activationReference (Zoho fulfillment ID)
   - salesOrderId (Zoho sales order)
   - status (PENDING, ACTIVE, FAILED, EXPIRED)
   - attempts (retry attempts)
   - lastAttemptAt
   - lastError
   - createdAt
   - updatedAt

3. t2mobile_webhook_logs
   - id (primary key)
   - eventType (ORDER_FULFILLED, ORDER_FAILED, SUBSCRIPTION_RENEWED, EXPIRY_REMINDER)
   - orderId (nullable, for non-order events)
   - payload (JSON)
   - response (JSON)
   - status (PENDING, SENT, FAILED)
   - retries
   - nextRetryAt
   - createdAt
```

### B. Tech Stack Additions
- **BullMQ**: Job queue for async order processing, webhook retries
- **Node-Cron**: Scheduler for expiry reminders, renewal checks
- **Crypto (built-in)**: HMAC-SHA256 signing for webhooks
- **Axios**: Already available, for making HTTP requests

### C. Key Workflows

#### 1. GET /products Flow
```
Client Request
    ↓
Validate API Key
    ↓
Fetch products from Zoho (cached)
    ↓
Format response for T2Mobile
    ↓
Return JSON
```

#### 2. POST /fulfilment Flow
```
T2Mobile sends order
    ↓
Validate API key & Idempotency-Key
    ↓
Check for duplicates in DB
    ↓
Validate product exists in Zoho
    ↓
Create job in BullMQ queue (async)
    ↓
Return immediate response (PROCESSING)
    ↓
[ASYNC] Create Zoho Sales Order
    ↓
[ASYNC] Provision license/fulfillment
    ↓
[ASYNC] Send webhook to T2Mobile (ORDER_FULFILLED or ORDER_FAILED)
    ↓
Update order status in DB
```

#### 3. Webhook Retry Flow (BullMQ)
```
Webhook send fails
    ↓
BullMQ retries (exponential backoff)
    ↓
Max retries reached → Log and alert
    ↓
Eventually succeeds → Confirm in DB
```

#### 4. Expiry Reminder Scheduler
```
Cron runs daily at 2AM
    ↓
Query all fulfillments expiring in 7 days
    ↓
Send EXPIRY_REMINDER webhook for each
    ↓
Log results
```

---

## Phase 2: Code Structure

### Directory Changes
```
src/
├── config/
│   ├── t2mobile.js (T2Mobile credentials)
│   └── bullmq.js (Job queue setup)
├── controllers/
│   ├── t2mobileController.js (NEW)
│   └── [existing controllers]
├── helpers/
│   ├── t2mobileHelper.js (NEW - HMAC, auth, validation)
│   ├── webhookHelper.js (NEW - webhook signing & sending)
│   ├── jobHelper.js (NEW - BullMQ job management)
│   └── [existing helpers]
├── models/
│   ├── t2mobileOrderModel.js (NEW)
│   ├── t2mobileFulfillmentModel.js (NEW)
│   └── [existing models]
├── routes/
│   ├── t2mobile.js (NEW)
│   └── [existing routes]
├── jobs/
│   ├── t2mobileOrderJob.js (NEW)
│   ├── webhookRetryJob.js (NEW)
│   └── expiryReminderJob.js (NEW)
└── schedulers/
    └── t2mobileScheduler.js (NEW)
```

---

## Phase 3: Implementation Steps

### Step 1: Setup Environment
- Add T2Mobile credentials to `.env`
- Configure BullMQ (Redis connection)
- Create database migrations

### Step 2: Create Models
- t2mobileOrderModel.js
- t2mobileFulfillmentModel.js

### Step 3: Create Helpers
- t2mobileHelper.js (API key validation, HMAC signing, payload validation)
- webhookHelper.js (sign and send webhooks with retry)
- jobHelper.js (BullMQ queue definition)

### Step 4: Create Job Definitions
- t2mobileOrderJob.js (Zoho integration, fulfillment logic)
- webhookRetryJob.js (Handle webhook retries)
- expiryReminderJob.js (Scheduled expiry reminders)

### Step 5: Create Controllers
- t2mobileController.js (GET /products, POST /fulfilment endpoints)

### Step 6: Create Routes
- t2mobile.js (Mount new endpoints)

### Step 7: Setup Scheduler
- t2mobileScheduler.js (Start cron jobs on app load)

### Step 8: Integration Points
- Update app.js to mount new routes
- Initialize BullMQ queues
- Start scheduler on app startup

---

## Phase 4: Code Cleanup
- Remove unused routes (check which endpoints T2Mobile doesn't use)
- Refactor existing Zoho integration if needed
- Review and optimize requestController.js

---

## API Specifications

### 1. GET /t2mobile/products
```
Request:
  GET /t2mobile/products
  Headers: Authorization: Bearer {api_key}

Response (200):
{
  "partnerId": "ICONTECH001",
  "products": [...]
}

Errors:
  401: Unauthorized
  429: Rate limited
```

### 2. POST /t2mobile/fulfilment
```
Request:
  POST /t2mobile/fulfilment
  Headers:
    Authorization: Bearer {api_key}
    Idempotency-Key: {uuid}
  Body: { orderId, productId, customerId, ... }

Response (202):
{
  "success": true,
  "orderId": "T2M123456",
  "status": "PROCESSING",
  "activationReference": "ZOH123456"
}

Response (400/409):
{
  "success": false,
  "errorCode": "...",
  "message": "..."
}
```

---

## Security Checklist
- [ ] API key validation on every request
- [ ] HMAC-SHA256 signing on all webhooks
- [ ] Idempotency key to prevent duplicate orders
- [ ] Rate limiting (100 req/min)
- [ ] HTTPS only
- [ ] Request/response logging (masked sensitive data)
- [ ] Input validation and sanitization
- [ ] Error messages don't leak system details

---

## Testing Strategy

### Unit Tests
- HMAC signing generation
- Idempotency key checking
- API key validation
- Payload validation

### Integration Tests
- GET /products flow
- POST /fulfilment flow
- Webhook retry logic
- Zoho integration

### Manual Testing
- curl requests to endpoints
- Webhook simulation
- Error scenarios

---

## Deployment Checklist
- [ ] Redis running for BullMQ
- [ ] Database migrations applied
- [ ] Environment variables set
- [ ] SSL certificates configured
- [ ] Rate limiter deployed
- [ ] Logging configured
- [ ] Monitoring/alerting setup
- [ ] T2Mobile credentials validated

---

## Support & Debugging

### Logs to Monitor
- API request/response logs
- Job queue logs (BullMQ)
- Webhook payload logs
- Zoho API errors
- Database transaction logs

### Common Issues
1. Idempotency key not unique → Check DB constraints
2. Webhook HMAC mismatch → Verify webhook secret
3. Zoho API rate limit → Implement backoff
4. Order stuck in PROCESSING → Check job queue logs

---

## Rollback Plan
- Keep existing endpoints running
- New T2Mobile routes under `/t2mobile` prefix
- Easy to disable/remove if needed
- Database rollback scripts ready

