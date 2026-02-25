# T2Mobile Integration - Developer Setup Guide

## Overview
This guide walks you through setting up and deploying the T2Mobile integration in the IconTech codebase.

---

## Phase 1: Prerequisites & Installation

### 1.1 System Requirements
- Node.js 16+ 
- npm or yarn
- Redis server (local or remote)
- MySQL/PostgreSQL database

### 1.2 Install Required Packages
Add these packages to your `package.json` and run `npm install`:

```bash
npm install bull redis uuid crypto express-rate-limit node-cron axios
```

Alternatively, add manually to package.json:
```json
{
  "dependencies": {
    "bull": "^4.11.0",
    "redis": "^4.6.0",
    "uuid": "^9.0.0",
    "node-cron": "^3.0.2",
    "express-rate-limit": "^6.7.0",
    "axios": "^1.4.0"
  }
}
```

Then run `npm install`.

### 1.3 Verify Installation
```bash
npm list bull redis uuid node-cron express-rate-limit
```

---

## Phase 2: Environment Configuration

### 2.1 Configure Environment Variables
1. Copy the template:
   ```bash
   cp .env.t2mobile.example .env.local
   ```

2. Edit `.env.local` with your credentials:
   ```bash
   # T2Mobile credentials (from Kenneth Epiah)
   T2MOBILE_API_KEY=your_api_key
   T2MOBILE_WEBHOOK_SECRET=your_webhook_secret
   T2MOBILE_WEBHOOK_URL=https://t2mobile.com/api/webhook/order-status
   T2MOBILE_PARTNER_ID=ICONTECH001
   
   # Zoho credentials
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

### 2.2 Get Credentials from T2Mobile
Contact: kenneth.epiah@t2mobile.com.ng

Required from T2Mobile:
- API Key (`T2MOBILE_API_KEY`)
- Webhook Secret (`T2MOBILE_WEBHOOK_SECRET`)
- Webhook Endpoint URL

---

## Phase 3: Database Setup

### 3.1 Create Database Migrations
Create a migration file (e.g., `migrations/20260219-create-t2mobile-tables.js`):

```javascript
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('t2mobile_orders', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      orderId: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      customerId: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      customerName: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      customerEmail: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      customerPhone: {
        type: Sequelize.STRING(20)
      },
      productId: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      tenure: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('PENDING', 'PROCESSING', 'FULFILLED', 'FAILED', 'CANCELLED'),
        defaultValue: 'PENDING'
      },
      zohoSalesOrderId: {
        type: Sequelize.STRING(100)
      },
      activationReference: {
        type: Sequelize.STRING(100)
      },
      idempotencyKey: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      orderDate: {
        type: Sequelize.DATE
      },
      errorMessage: {
        type: Sequelize.TEXT
      },
      metadata: {
        type: Sequelize.JSON
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // Create indexes
    await queryInterface.addIndex('t2mobile_orders', ['orderId']);
    await queryInterface.addIndex('t2mobile_orders', ['status']);
    await queryInterface.addIndex('t2mobile_orders', ['idempotencyKey']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('t2mobile_orders');
    await queryInterface.dropTable('t2mobile_fulfillments');
    await queryInterface.dropTable('t2mobile_webhook_logs');
  }
};
```

### 3.2 Run Migrations (if using ORM)
If using Sequelize CLI:
```bash
npx sequelize-cli db:migrate
```

Or rely on Sequelize's auto-sync (already configured in codebase):
The app will automatically create tables on startup.

---

## Phase 4: Redis Setup

### 4.1 Local Redis (Development)

**On Windows (WSL2):**
```bash
# Install Redis on WSL2
wsl --install
# Inside WSL
sudo apt-get update
sudo apt-get install -y redis-server
redis-server
```

**Or use Docker:**
```bash
docker run -d -p 6379:6379 redis:latest
```

**On macOS:**
```bash
brew install redis
redis-server
```

### 4.2 Verify Redis Connection
```bash
redis-cli ping
# Should return: PONG
```

### 4.3 Remote Redis (Production)
Update environment variables:
```bash
REDIS_HOST=your-redis-host.com
REDIS_PORT=6379
REDIS_PASSWORD=your_password
```

---

## Phase 5: Zoho API Configuration

### 5.1 Setup Zoho OAuth2
1. Go to https://accounts.zoho.com/developerconsole
2. Create a Server-based OAuth Client
3. Configure Redirect URL:
   ```
   https://api.icontech.com/zoho/callback
   ```
4. Generate authorization code
5. Get refresh token
6. Store in `.env.local`:
   ```bash
   ZOHO_CLIENT_ID=your_client_id
   ZOHO_CLIENT_SECRET=your_client_secret
   ZOHO_REFRESH_TOKEN=your_refresh_token
   ```

### 5.2 Create Service Items in Zoho
Create each product as a "Service Item" in Zoho Inventory:
- Product ID: `ZOHO_CRM_STD`
- Name: "Zoho CRM Standard"
- Price: 150000 NGN
- Use this ID in T2Mobile product catalogue

---

## Phase 6: Running the Application

### 6.1 Development Mode
```bash
# Ensure Redis is running
redis-server

# In another terminal, start the app
npm run dev
# or
node app.js
```

Expected output:
```
✓ T2Mobile configuration validated
✓ Job queues initialized
✓ T2Mobile routes mounted
Obana is running on port 4000
```

### 6.2 Production Mode
```bash
NODE_ENV=production npm start
```

### 6.3 Health Check
```bash
curl http://localhost:4000/t2mobile/health
# Response:
# {"status":"healthy","service":"t2mobile-integration","timestamp":"..."}
```

---

## Phase 7: Testing the API

### 7.1 Test GET /products

```bash
curl -X GET http://localhost:4000/t2mobile/products \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

Expected Response (202):
```json
{
  "success": true,
  "data": {
    "partnerId": "ICONTECH001",
    "products": [
      {
        "productId": "ZOHO_CRM_STD",
        "name": "Zoho CRM Standard",
        "cost": 150000,
        "currency": "NGN",
        "tenure": "12_MONTHS"
      }
    ]
  }
}
```

### 7.2 Test POST /fulfilment

```bash
curl -X POST http://localhost:4000/t2mobile/fulfilment \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "T2M123456",
    "productId": "ZOHO_CRM_STD",
    "customerId": "T2M_USER_9001",
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "customerPhone": "08012345678",
    "tenure": "12_MONTHS"
  }'
```

Expected Response (202):
```json
{
  "success": true,
  "orderId": "T2M123456",
  "status": "PROCESSING",
  "activationReference": "ZOHO_CRM_STD_T2M123456",
  "message": "Order received and processing"
}
```

### 7.3 Test Duplicate Order (Idempotency)
Send the same request again with the same Idempotency-Key:
```bash
# Response will be 200 (not 202) with isDuplicate: true
```

### 7.4 Check Order Status

```bash
curl -X GET http://localhost:4000/t2mobile/orders/T2M123456 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## Phase 8: Monitoring & Debugging

### 8.1 Monitor Job Queue
```bash
# Check job queue stats programmatically
node -e "
const JobHelper = require('./src/helpers/jobHelper');
JobHelper.initQueue('t2mobile-orders');
JobHelper.getQueueStats('t2mobile-orders').then(stats => {
  console.log(JSON.stringify(stats, null, 2));
});
"
```

### 8.2 View Redis Keys (Development)
```bash
redis-cli
> KEYS "*t2mobile*"
> KEYS "*bull*"
```

### 8.3 Check Database Records
```bash
# Using your database client, query:
SELECT * FROM t2mobile_orders WHERE status = 'PROCESSING';
SELECT * FROM t2mobile_fulfillments;
SELECT * FROM t2mobile_webhook_logs;
```

### 8.4 Monitor Scheduler
```bash
# Logs will show:
# [Scheduler] Running webhook retry job...
# [Scheduler] Running expiry reminder job...
```

---

## Phase 9: Troubleshooting

### Issue: "T2MOBILE_API_KEY not configured"
**Solution:** 
- Ensure `.env.local` is created and contains `T2MOBILE_API_KEY`
- Verify `require('dotenv').config()` is at top of app.js

### Issue: "Cannot connect to Redis"
**Solution:**
- Verify Redis is running: `redis-cli ping`
- Check `REDIS_HOST` and `REDIS_PORT` in `.env.local`
- If using Docker: `docker ps` to verify container is running

### Issue: "Job not processing"
**Solution:**
- Verify BullMQ job processor was registered
- Check job queue logs: `redis-cli`-> `LRANGE bull:t2mobile-orders:*`
- Restart the application

### Issue: "Webhook not sent back to T2Mobile"
**Solution:**
- Verify webhook URL is correct
- Check network connectivity to T2Mobile endpoint
- Review webhook logs in database: `SELECT * FROM t2mobile_webhook_logs`

### Issue: "Zoho Sales Order creation failed"
**Solution:**
- Verify Zoho credentials are correct
- Check Zoho token is valid and not expired
- Check organization ID matches your Zoho instance
- Verify product ID exists in Zoho

---

## Phase 10: Deployment Checklist

- [ ] All environment variables configured
- [ ] Redis running and accessible
- [ ] Database migrations applied
- [ ] Zoho credentials validated
- [ ] T2Mobile API key received
- [ ] Webhook secret securely stored
- [ ] HTTPS/SSL certificates configured
- [ ] Rate limiting active
- [ ] Logging configured
- [ ] Health check passing
- [ ] Test order processed successfully
- [ ] Webhook received from T2Mobile

---

## Phase 11: Production Considerations

### Security
- [ ] Use environment variables (never hardcode)
- [ ] Enable request validation
- [ ] API rate limiting (100 req/min default)
- [ ] HTTPS only
- [ ] Request/response logging with masked sensitive data

### Performance
- [ ] Redis persistence enabled
- [ ] Job queue backlog monitored
- [ ] Webhook retry backoff configured
- [ ] Database indexes created

### Monitoring
- [ ] Application logs centralized (e.g., CloudWatch, Datadog)
- [ ] Job queue metrics monitored
- [ ] Database performance tracked
- [ ] Webhook success/failure rates monitored

### Backup
- [ ] Database backups automated
- [ ] Redis snapshots configured
- [ ] Disaster recovery plan documented

---

## Support & Resources

**T2Mobile Support:**
- Contact: kenneth.epiah@t2mobile.com.ng
- Documentation: [T2Mobile Developer Portal]

**Zoho Support:**
- Portal: https://accounts.zoho.com/
- API Docs: https://www.zoho.com/inventory/api/

**IconTech Team:**
- Lead: +2347035599433
- Documentation: See `T2MOBILE_INTEGRATION_WORKFLOW.md`

---

## File Structure Overview

```
src/
├── config/
│   └── t2mobile.js                 ← Configuration & validation
├── controllers/
│   └── t2mobileController.js       ← API endpoints
├── helpers/
│   ├── t2mobileHelper.js           ← Auth, HMAC, validation
│   ├── webhookHelper.js            ← Webhook operations
│   └── jobHelper.js                ← BullMQ management
├── jobs/
│   ├── t2mobileOrderJob.js         ← Order processing
│   ├── webhookRetryJob.js          ← Webhook retry logic
│   └── expiryReminderJob.js        ← Expiry job
├── models/
│   ├── t2mobileOrderModel.js       ← Order model
│   ├── t2mobileFulfillmentModel.js ← Fulfillment model
│   └── t2mobileWebhookLogModel.js  ← Webhook log model
├── routes/
│   └── t2mobile.js                 ← API routes
└── schedulers/
    └── t2mobileScheduler.js        ← Cron jobs
```

---

## Next Steps

1. **Get Credentials:** Contact T2Mobile for API key and webhook secret
2. **Configure Zoho:** Set up OAuth2 credentials
3. **Setup Environment:** Configure `.env.local` with credentials
4. **Run Redis:** Ensure Redis server is running
5. **Start App:** Run `npm run dev`
6. **Test APIs:** Use curl commands provided in Phase 7
7. **Monitor:** Watch logs for successful order processing
8. **Deploy:** Follow deployment checklist before production

---

**Integration Complete!** 🎉

Your IconTech codebase is now ready to handle T2Mobile orders, create Zoho Sales Orders, and manage subscriptions.

