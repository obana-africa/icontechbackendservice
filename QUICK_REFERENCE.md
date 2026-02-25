# T2Mobile Integration - Quick Reference Card

## API Endpoints Summary

| Endpoint | Method | Purpose | Auth | Rate Limit |
|----------|--------|---------|------|-----------|
| `/t2mobile/products` | GET | Fetch product catalogue | Bearer | 100/min |
| `/t2mobile/fulfilment` | POST | Submit order | Bearer | 100/min |
| `/t2mobile/orders/:id` | GET | Check order status | Bearer | 100/min |
| `/t2mobile/health` | GET | Health check | None | None |

---

## Quick Start Commands

### 1. Setup Environment
```bash
cp .env.t2mobile.example .env.local

# Edit .env.local with:
# - T2MOBILE_API_KEY
# - T2MOBILE_WEBHOOK_SECRET
# - T2MOBILE_WEBHOOK_URL
# - Zoho credentials
# - Redis connection
```

### 2. Install Dependencies
```bash
npm install bull redis uuid node-cron express-rate-limit
```

### 3. Start Redis
```bash
# Local
redis-server

# Or Docker
docker run -d -p 6379:6379 redis:latest
```

### 4. Run Application
```bash
npm start
# Verify: curl http://localhost:4000/t2mobile/health
```

---

## API Request Examples

### GET /products
```bash
curl -X GET http://localhost:4000/t2mobile/products \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### POST /fulfilment (Order)
```bash
curl -X POST http://localhost:4000/t2mobile/fulfilment \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "T2M_001",
    "productId": "ZOHO_CRM_STD",
    "customerId": "T2M_USER_001",
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "customerPhone": "08012345678",
    "tenure": "12_MONTHS"
  }'
```

### GET /orders/:orderId
```bash
curl -X GET http://localhost:4000/t2mobile/orders/T2M_001 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## File Structure Quick Map

```
Application Entry:
  └─ app.js [lines 109-122 modified]
     ├─ Initialize T2Mobile config
     ├─ Start job processors
     ├─ Start scheduler
     └─ Mount /t2mobile routes

Configuration:
  └─ src/config/t2mobile.js
     ├─ API credentials
     ├─ Zoho settings
     ├─ Redis config
     └─ Validation

Routes:
  └─ src/routes/t2mobile.js
     ├─ GET /products
     ├─ POST /fulfilment
     └─ GET /orders/:orderId

Controllers:
  └─ src/controllers/t2mobileController.js
     ├─ getProducts()
     ├─ createFulfillment()
     └─ getOrderStatus()

Helpers:
  ├─ src/helpers/t2mobileHelper.js
  │  ├─ validateApiKey()
  │  ├─ validatePayload()
  │  ├─ signWebhookPayload()
  │  └─ checkDuplicateOrder()
  │
  ├─ src/helpers/webhookHelper.js
  │  ├─ sendWebhook()
  │  ├─ retryFailedWebhooks()
  │  └─ createWebhookPayload()
  │
  └─ src/helpers/jobHelper.js
     ├─ initQueue()
     ├─ addJob()
     └─ processQueue()

Jobs:
  ├─ src/jobs/t2mobileOrderJob.js
  │  └─ process() → Create SO + Send Webhook
  │
  ├─ src/jobs/webhookRetryJob.js
  │  └─ process() → Retry Failed Webhooks
  │
  └─ src/jobs/expiryReminderJob.js
     └─ process() → Send Expiry Reminders

Scheduler:
  └─ src/schedulers/t2mobileScheduler.js
     ├─ scheduleWebhookRetry() [every 5 min]
     ├─ scheduleExpiryReminder() [daily 2 AM]
     └─ scheduleRenewalCheck() [daily 3 AM]

Models:
  ├─ src/models/t2mobileOrderModel.js
  ├─ src/models/t2mobileFulfillmentModel.js
  └─ src/models/t2mobileWebhookLogModel.js
```

---

## Code Change Summary

### Modified: app.js
```javascript
// Added at top (line 17)
const t2mobileRoute = require('./src/routes/t2mobile');

// Added before Swagger (around line 52)
const t2mobileConfig = require('./src/config/t2mobile');
try {
    if (process.env.T2MOBILE_API_KEY) {
        t2mobileConfig.validateConfig();
        // Initialize JobHelper and JobProcessors
        // Initialize Scheduler
        // Mount routes
        app.use('/t2mobile', t2mobileRoute);
    }
} catch (error) {
    console.error('T2Mobile config error:', error.message);
}
```

### Modified: src/models/index.js
```javascript
// Added before cache (around line 51)
db.t2mobile_orders = require('./t2mobileOrderModel.js')(sequelize, DataTypes)
db.t2mobile_fulfillments = require('./t2mobileFulfillmentModel.js')(sequelize, DataTypes)
db.t2mobile_webhook_logs = require('./t2mobileWebhookLogModel.js')(sequelize, DataTypes)
```

---

## Environment Variables Needed

```env
# T2Mobile
T2MOBILE_PARTNER_ID=ICONTECH001
T2MOBILE_API_KEY=your_key_from_t2mobile
T2MOBILE_WEBHOOK_SECRET=your_secret_from_t2mobile
T2MOBILE_WEBHOOK_URL=https://t2mobile.com/api/webhook/order-status

# Zoho (OAuth2)
ZOHO_ORGANIZATION_ID=your_org_id
ZOHO_CLIENT_ID=your_client_id
ZOHO_CLIENT_SECRET=your_client_secret
ZOHO_REFRESH_TOKEN=your_refresh_token

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# App
NODE_ENV=development
PORT=4000
```

---

## Status Codes & Meanings

| Code | Meaning | When |
|------|---------|------|
| 200 | OK | Products fetched, order status retrieved |
| 201 | Created | Resource created (not used in this API) |
| 202 | Accepted | Order received, processing started |
| 400 | Bad Request | Invalid payload or missing required field |
| 401 | Unauthorized | Invalid API key |
| 404 | Not Found | Order not found |
| 409 | Conflict | Duplicate order detected |
| 429 | Too Many | Rate limit exceeded |
| 500 | Server Error | Internal error |

---

## Troubleshooting Quick Fixes

| Problem | Solution |
|---------|----------|
| "API key not configured" | Check .env.local has T2MOBILE_API_KEY |
| "Cannot connect to Redis" | Run `redis-server` or `docker run -d -p6379:6379 redis` |
| "Job not processing" | Verify Redis is running and job processor started |
| "Webhook not sent" | Check webhook URL is correct and T2Mobile is reachable |
| "Duplicate order issue" | Verify Idempotency-Key is included and unique |
| "Zoho order creation fails" | Verify Zoho credentials and product ID exists |

---

## Key Classes & Methods

### T2MobileHelper
```javascript
T2MobileHelper.validateApiKey(apiKey)           // → boolean
T2MobileHelper.validateFulfillmentPayload(data) // → {isValid, error}
T2MobileHelper.checkDuplicateOrder(idempotencyKey) // → Order|null
T2MobileHelper.generateWebhookSignature(payload) // → string
T2MobileHelper.parseZohoError(error)            // → {errorMessage, errorCode}
```

### WebhookHelper
```javascript
WebhookHelper.createWebhookPayload(eventType, data) // → object
WebhookHelper.sendWebhook(eventType, data)          // → {success, error}
WebhookHelper.retryFailedWebhooks()                 // → {processed, successful, failed}
```

### JobHelper
```javascript
JobHelper.initQueue(queueName)           // → Queue
JobHelper.addJob(queueName, data, opts) // → {jobId, status}
JobHelper.processQueue(queueName, fn)    // → void
JobHelper.getQueueStats(queueName)       // → stats object
```

### T2MobileScheduler
```javascript
T2MobileScheduler.initialize()    // Start all cron jobs
T2MobileScheduler.stopAll()       // Stop all tasks
T2MobileScheduler.getStatus()     // Get task statuses
T2MobileScheduler.restart()       // Restart scheduler
```

---

## Common Workflow: Process New Order

```
1. T2Mobile sends: POST /t2mobile/fulfilment
   ├─ Authorization: Bearer API_KEY
   ├─ Idempotency-Key: unique_id
   └─ Body: order details

2. API Handler (T2MobileController.createFulfillment)
   ├─ Validate API key ✓
   ├─ Check Idempotency-Key ✓
   ├─ Validate payload ✓
   ├─ Create order record in DB (status: PENDING) ✓
   ├─ Queue async job ✓
   └─ Return 202 Accepted ✓

3. Background Job (T2MobileOrderJob.process)
   ├─ Get Zoho token
   ├─ Create Zoho Sales Order
   ├─ Provision license
   ├─ Update order status: FULFILLED
   ├─ Create fulfillment record
   └─ Send webhook: ORDER_FULFILLED

4. Webhook Callback (Optional)
   ├─ T2Mobile receives: ORDER_FULFILLED
   ├─ Updates their order status
   └─ Notifies customer
```

---

## Monitoring Commands

### Check Job Queue Status
```bash
# Via Redis CLI
redis-cli
> KEYS "*t2mobile*"
> LLEN bull:t2mobile-orders:*

# Via custom script
node -e "
const JobHelper = require('./src/helpers/jobHelper');
JobHelper.getQueueStats('t2mobile-orders').then(console.log);
"
```

### Query Recent Orders
```bash
# In MySQL/PostgreSQL client
SELECT * FROM t2mobile_orders 
ORDER BY createdAt DESC 
LIMIT 10;

SELECT * FROM t2mobile_orders 
WHERE status IN ('FAILED', 'PENDING')
ORDER BY createdAt DESC;
```

### View Webhook Activity
```bash
SELECT eventType, status, COUNT(*) as count, MAX(sentAt) 
FROM t2mobile_webhook_logs 
GROUP BY eventType, status 
ORDER BY MAX(sentAt) DESC;
```

---

## Performance Tips

1. **Scale Job Processors:** Increase concurrency in jobHelper
2. **Database Indexes:** Ensure all lookup columns are indexed
3. **Redis Persistence:** Enable AOF in production
4. **Monitor Queue Depth:** Watch BullMQ queue length
5. **Cache Products:** Implement Redis caching for products
6. **Use CDN:** For product images

---

## Security Checklist

- [ ] Environment variables not in code
- [ ] HTTPS enforced in production
- [ ] API key rotated regularly
- [ ] Webhook secret secured
- [ ] Request payloads logged without sensitivity
- [ ] Database credentials encrypted
- [ ] Rate limiting active
- [ ] Input validation on all endpoints
- [ ] Error messages don't leak internals

---

## Documentation Links

- **Setup:** See SETUP_GUIDE.md
- **Architecture:** See T2MOBILE_INTEGRATION_WORKFLOW.md
- **Full Implementation:** See IMPLEMENTATION_SUMMARY.md
- **Zoho API:** https://www.zoho.com/inventory/api/
- **BullMQ Docs:** https://docs.bullmq.io/

---

## Support & Escalation

**Technical Issues:**
- Check logs: `tail -f logs/app.log`
- Debug mode: `DEBUG=* npm start`
- Redis: `redis-cli monitor`

**Contact:**
- T2Mobile: kenneth.epiah@t2mobile.com.ng
- IconTech: +2347035599433

**Useful CLI Tools:**
```bash
# Debug job queue
bull-board

# Monitor Redis
redis-commander

# Check port usage
lsof -i :4000

# View realtime logs
tail -f /var/log/app.log | grep "T2Mobile"
```

---

**Ready to Deploy!** 🚀

Follow SETUP_GUIDE.md for detailed instructions.

