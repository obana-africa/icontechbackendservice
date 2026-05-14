# T2Mobile Integration - Quick Reference

## API Endpoints

### Product Listing
```
GET /t2mobile/:partnerId/products
Headers:
  X-Api-Key: {api_key}
  X-Api-Timestamp: {unix_timestamp}
  X-Api-Signature: {hmac_sha256_base64}

Response (200):
{
  "statusCode": "PL-100",
  "statusDescription": "Product List Success",
  "data": [...]
}
```

### Create Fulfillment
```
POST /t2mobile/:partnerId/fulfilment/:fulfilmentId
Headers:
  X-Api-Key: {api_key}
  X-Api-Timestamp: {unix_timestamp}
  X-Api-Signature: {hmac_sha256_base64}
  Idempotency-Key: {unique_request_id}

Body:
{
  "orderId": "T2M123456",
  "product": {
    "fulfilmentEngineId": 1461,
    "externalProductId": "PROD_001",
    "cost": 6990.36,
    "currency": "NGN",
    "tenureDays": 30,
    "status": "ACTIVE"
  },
  "customer": {
    "email": "customer@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "08012345678",
    "is9mobile": false
  }
}

Response (202):
{
  "statusCode": "FF-200",
  "statusDescription": "Fulfilment Pending",
  "data": {
    "orderId": "T2M123456",
    "status": "PROCESSING",
    "activationReference": "ZOHT2M123456"
  }
}
```

### Get Order Status
```
GET /t2mobile/orders/:orderId
Headers:
  X-Api-Key: {api_key}
  X-Api-Timestamp: {unix_timestamp}
  X-Api-Signature: {hmac_sha256_base64}

Response (200):
{
  "statusCode": "FF-100",
  "statusDescription": "Fulfilment Successful",
  "data": {
    "orderId": "T2M123456",
    "status": "FULFILLED",
    "activationReference": "ZOHT2M123456",
    "salesOrderId": "SO-001"
  }
}
```

---

## HMAC Signature Generation

### In Node.js

```javascript
const crypto = require('crypto');

function generateHmacSignature(method, path, timestamp, body, apiSecret) {
  // 1. Calculate body hash
  const bodyHash = crypto
    .createHash('sha256')
    .update(body || '', 'utf8')
    .digest('hex');

  // 2. Build string to sign
  const stringToSign = `${method.toUpperCase()}\n${path}\n${timestamp}\n${bodyHash}`;

  // 3. Generate HMAC
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(stringToSign, 'utf8')
    .digest('base64');

  return signature;
}

// Usage
const method = 'GET';
const path = '/t2mobile/ICONTECH001/products';
const timestamp = Math.floor(Date.now() / 1000);
const body = ''; // Empty for GET
const apiSecret = process.env.T2MOBILE_API_SECRET;

const signature = generateHmacSignature(method, path, timestamp, body, apiSecret);

// Include in headers:
// X-Api-Key: {api_key}
// X-Api-Timestamp: {timestamp}
// X-Api-Signature: {signature}
```

### In Python

```python
import hmac
import hashlib
import json
import base64
import time

def generate_hmac_signature(method, path, timestamp, body, api_secret):
    # 1. Calculate body hash
    body_bytes = body.encode('utf-8') if isinstance(body, str) else body
    body_hash = hashlib.sha256(body_bytes).hexdigest()
    
    # 2. Build string to sign
    string_to_sign = f"{method.upper()}\n{path}\n{timestamp}\n{body_hash}"
    
    # 3. Generate HMAC
    signature = hmac.new(
        api_secret.encode('utf-8'),
        string_to_sign.encode('utf-8'),
        hashlib.sha256
    ).digest()
    
    return base64.b64encode(signature).decode('utf-8')

# Usage
method = 'POST'
path = '/t2mobile/ICONTECH001/fulfilment/12345'
timestamp = int(time.time())
body = json.dumps({...})
api_secret = os.environ['T2MOBILE_API_SECRET']

signature = generate_hmac_signature(method, path, timestamp, body, api_secret)

# Include in headers
headers = {
    'X-Api-Key': api_key,
    'X-Api-Timestamp': str(timestamp),
    'X-Api-Signature': signature
}
```

---

## Error Codes Reference

| Code | Meaning | HTTP | Action |
|------|---------|------|--------|
| **FF-100** | Fulfillment Successful | 200 | Success ✓ |
| **FF-200** | Fulfillment Pending | 202 | Poll status |
| **FF-300** | Invalid Request Payload | 400 | Fix request |
| **FF-301** | Invalid Product ID | 400 | Verify product |
| **FF-302** | Invalid Customer ID | 400 | Verify customer |
| **FF-400** | Fulfillment Failed | 400 | Retry or escalate |
| **FF-401** | Product Out of Stock | 400 | Not available |
| **FF-500** | Internal System Error | 500 | Retry later |
| **PL-100** | Product List Success | 200 | Success ✓ |
| **PL-500** | Product List Error | 500 | Retry later |
| **AA-304** | Unauthorized Request | 401 | Check API key |
| **AA-305** | Authentication Failed | 401 | Invalid signature |

---

## Revenue Split Example

```javascript
// Order with cost
const order = {
  orderId: 'T2M123456',
  cost: 10000,          // NGN
  currency: 'NGN'
};

// Partner with 30% revenue share
const partner = {
  revenueShare: 0.30
};

// Split calculation
const grossAmount = order.cost;                    // 10000
const partnerAmount = grossAmount * 0.30;         // 3000 (T2Mobile)
const icontechAmount = grossAmount - 3000;        // 7000 (Icontech)

// Settlement record created
await db.revenue_settlements.create({
  orderId: 'T2M123456',
  partnerId: 'T2MOBILE001',
  grossAmount: 10000,
  revenueShare: 0.30,
  partnerAmount: 3000,
  icontechAmount: 7000,
  settlementStatus: 'PENDING'
});
```

---

## Webhook Events

### Order Fulfilled
```json
POST {renewalWebhookUrl}
Headers:
  X-Webhook-Signature: {hmac_sha256_base64}

Body:
{
  "orderId": "T2M123456",
  "activationReference": "ZOH123456",
  "status": "SUCCESS",
  "expiryDate": "2027-02-15"
}
```

### Order Failed
```json
POST {orderWebhookUrl}
Headers:
  X-Webhook-Signature: {hmac_sha256_base64}

Body:
{
  "orderId": "T2M123456",
  "status": "FAIL",
  "errorCode": "FF-400",
  "message": "Provisioning failed"
}
```

### Expiry Reminder
```json
POST {renewalWebhookUrl}
Headers:
  X-Webhook-Signature: {hmac_sha256_base64}

Body:
{
  "activationReference": "ZOH123456",
  "customerEmail": "customer@example.com",
  "cost": 150000,
  "currency": "NGN",
  "expiryDate": "2027-02-15"
}
```

---

## Database Models

### Partners
```javascript
{
  id: integer,
  partnerId: string (unique),
  companyName: string,
  tier: 'GOLD' | 'SILVER' | 'BRONZE',
  revenueShare: decimal,
  status: 'ACTIVE' | 'INACTIVE',
  apiBaseUrl: string,
  apiKey: string (encrypted),
  webhookSecret: string (encrypted),
  contactEmail: string,
  contactPhone: string,
  createdAt: datetime,
  updatedAt: datetime
}
```

### T2Mobile Orders
```javascript
{
  id: integer,
  orderId: string (unique),
  customerId: string,
  customerName: string,
  customerEmail: string,
  customerPhone: string,
  productId: string,
  cost: decimal,
  currency: string,
  tenure: string,
  status: 'PENDING' | 'PROCESSING' | 'FULFILLED' | 'FAILED',
  zohoSalesOrderId: string,
  activationReference: string,
  idempotencyKey: string (unique),
  errorMessage: text,
  metadata: json,
  createdAt: datetime,
  updatedAt: datetime
}
```

### Revenue Settlements
```javascript
{
  id: integer,
  orderId: string,
  partnerId: string,
  grossAmount: decimal,
  currency: string,
  revenueShare: decimal,
  partnerAmount: decimal,
  icontechAmount: decimal,
  settlementStatus: 'PENDING' | 'SETTLED' | 'FAILED',
  settlementDate: datetime,
  metadata: json,
  createdAt: datetime,
  updatedAt: datetime
}
```

---

## Scheduler Tasks

| Task | Schedule | Purpose |
|------|----------|---------|
| Webhook Retry | Every 5 min | Retry failed webhooks |
| Expiry Reminder | Daily 2 AM | Send renewal reminders |
| Renewal Check | Daily 3 AM | Check for renewals |

---

## Common Issues

### HMAC Signature Mismatch
- Ensure API_SECRET is correct
- Verify body is raw bytes, not JSON string
- Check timestamp hasn't expired (±300s)
- Verify method is uppercase
- Ensure path includes query string if present

### Duplicate Order Detection
- Idempotency-Key must be provided
- Same key returns existing order
- Key must be truly unique per request

### Webhook Not Received
- Check T2MOBILE_WEBHOOK_SECRET is set
- Verify webhook URL is correct
- Check X-Webhook-Signature in headers
- Review webhook retry logs
- Ensure T2Mobile endpoint accepts POST

---

## Development Notes

**Environment Setup**:
```bash
# Install dependencies
npm install

# Setup database
npm run migrate:up

# Start development server
npm run dev

# Environment variables (.env)
T2MOBILE_API_KEY=...
T2MOBILE_API_SECRET=...
REDIS_HOST=localhost
REDIS_PORT=6379
```

**Testing**:
```bash
# Test HMAC signature verification
curl -X GET http://localhost:3000/t2mobile/ICONTECH001/products \
  -H "X-Api-Key: {api_key}" \
  -H "X-Api-Timestamp: $(date +%s)" \
  -H "X-Api-Signature: {signature}"

# Test order creation
curl -X POST http://localhost:3000/t2mobile/ICONTECH001/fulfilment/123 \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: {api_key}" \
  -H "X-Api-Timestamp: $(date +%s)" \
  -H "X-Api-Signature: {signature}" \
  -H "Idempotency-Key: unique-id-123" \
  -d '{...order_payload...}'
```

---

Last Updated: 2026-02-14
Version: 1.4 (TDD Compliant)
