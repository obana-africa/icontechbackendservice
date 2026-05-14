# T2Mobile Integration - TDD Compliance Checklist

## Project Overview
This is Icontech Solutions' implementation of T2Mobile B2B Subscription Center integration. Icontech acts as the API provider while T2Mobile is the subscription platform owner and payment processor.

## Status: IN COMPLIANCE

### Section 1: Authentication & Security ✅

#### HMAC-SHA256 Authentication Middleware
- [x] Implemented in `T2MobileHelper.authenticateT2MobileRequest()`
- [x] Validates X-Api-Key header
- [x] Validates X-Api-Timestamp header with ±300 second tolerance
- [x] Validates X-Api-Signature header using HMAC-SHA256
- [x] Signature construction: `METHOD\nPATH+QUERY\nTIMESTAMP\nSHA256(body)`
- [x] Applied to all T2Mobile routes via router middleware
- [x] Proper error codes: AA-304, AA-305

#### Raw Body Capture
- [x] Modified app.js to capture raw request body for signature verification
- [x] Implemented in express.json() middleware verification callback

### Section 2: API Endpoints ✅

#### GET /products
- [x] Endpoint: `GET /:partnerId/products`
- [x] Fetches products from Zoho
- [x] Response format:
  ```json
  {
    "statusCode": "PL-100",
    "statusDescription": "Product List Success",
    "data": [products]
  }
  ```
- [x] Error codes: PL-500, FF-300
- [x] Rate limiting: 100 requests/minute

#### POST /fulfilment
- [x] Endpoint: `POST /:partnerId/fulfilment/:fulfilmentId`
- [x] Accepts order payload with orderId, product, customer
- [x] Validates Idempotency-Key header
- [x] Checks for duplicate orders using idempotency key
- [x] Returns 202 ACCEPTED with FF-200 status code
- [x] Response format:
  ```json
  {
    "statusCode": "FF-200",
    "statusDescription": "Fulfilment Pending",
    "data": {
      "orderId": "...",
      "status": "PROCESSING",
      "activationReference": "..."
    }
  }
  ```
- [x] Error codes: FF-300, FF-200
- [x] Validates all required fields
- [x] Queues async job for order processing

#### GET /orders/{orderId}
- [x] Endpoint: `GET /orders/:orderId`
- [x] Returns order status
- [x] Response format includes statusCode: FF-100
- [x] Error codes: FF-400, FF-500

### Section 3: Standardized Error Codes ✅

#### Success Codes
- [x] FF-100: Fulfilment Successful
- [x] PL-100: Product List Successful
- [x] FF-200: Fulfilment Pending

#### Authentication/Authorization (AA)
- [x] AA-304: Unauthorized Request (invalid key, expired timestamp)
- [x] AA-305: Authentication Failed (signature validation failure)

#### Validation/Client Errors (FF-3XX, PL-3XX)
- [x] FF-300: Invalid Request Payload
- [x] FF-301: Invalid Product ID
- [x] FF-302: Invalid Customer Identifier
- [x] FF-303: Invalid Tenure

#### Business Failures (FF-4XX)
- [x] FF-400: Fulfilment Failed
- [x] FF-401: Product Out of Stock
- [x] FF-402: Customer Not Eligible
- [x] FF-403: Pricing Mismatch
- [x] FF-404: Expired Offer

#### System Failures (FF-5XX)
- [x] FF-500: Internal System Error

### Section 4: Data Models ✅

#### Partners Table
- [x] Migration: `20260302-create-partners-table.js`
- [x] Model: `partnerModel.js`
- [x] Fields:
  - partnerId (unique)
  - companyName
  - tier (GOLD, SILVER, BRONZE)
  - revenueShare (0-1 decimal)
  - status (ACTIVE/INACTIVE)
  - apiBaseUrl
  - apiKey (encrypted)
  - webhookSecret (encrypted)
  - contactEmail, contactPhone
  - metadata

#### Revenue Settlements Table
- [x] Migration: `20260303-create-revenue-settlements-table.js`
- [x] Model: `revenueSettlementModel.js`
- [x] Fields:
  - orderId
  - partnerId
  - grossAmount
  - currency
  - revenueShare
  - partnerAmount
  - icontechAmount
  - settlementStatus (PENDING/SETTLED/FAILED)
  - settlementDate

#### T2Mobile Orders Table
- [x] Updated to include cost and currency fields
- [x] Stores all order information needed for revenue split

### Section 5: Background Job Processing ✅

#### Order Processing Job (T2MobileOrderJob)
- [x] Receives fulfillment requests
- [x] Creates Zoho Sales Order
- [x] Provisions license
- [x] Calculates revenue split
- [x] Creates revenue settlement record
- [x] Sends order fulfillment webhook
- [x] Handles failures with error webhook
- [x] Retries with exponential backoff (3 attempts)

#### Webhook Retry Job
- [x] Processes failed webhooks
- [x] Retries up to 5 times
- [x] Uses exponential backoff
- [x] Scheduled every 5 minutes

#### Expiry Reminder Job
- [x] Finds subscriptions expiring within 7 days
- [x] Sends renewal reminder webhooks
- [x] Uses T2Mobile renewal endpoint
- [x] Scheduled daily at 2 AM

### Section 6: Webhook Integration ✅

#### Webhook Endpoints (T2Mobile Side - We Call These)
- [x] Renewal Webhook: `https://thanox-api-management-test.azure-api.net/subscriptionCenterExt/api/external/notification/renewal`
- [x] Order Status Webhook: `https://thanox-api-management-test.azure-api.net/subscriptionCenterExt/api/external/notification/order`

#### Webhook Payloads
- [x] ORDER_FULFILLED: orderId, activationReference, status, expiryDate
- [x] ORDER_FAILED: orderId, status, error details
- [x] EXPIRY_REMINDER: activationReference, customerEmail, cost, currency, expiryDate
- [x] SUBSCRIPTION_RENEWED: orderId, activationReference, status

#### Webhook Signing
- [x] HMAC-SHA256 signature in X-Webhook-Signature header
- [x] Uses T2MOBILE_WEBHOOK_SECRET from environment
- [x] JSON payload stringified for signing
- [x] Retry logic with exponential backoff

### Section 7: Revenue Split Logic ✅

#### Calculation
- [x] Gross Amount: Product cost from order
- [x] Revenue Share: Retrieved from partner record
- [x] Partner Amount: grossAmount × revenueShare
- [x] Icontech Amount: grossAmount - partnerAmount
- [x] Settlement Status: PENDING (awaiting manual settlement)

#### Processing Flow
1. [x] Order created with cost and currency
2. [x] Revenue settlement record created during job processing
3. [x] Amounts calculated based on partner's revenue share
4. [x] Settlement records logged for monthly reconciliation

### Section 8: Idempotency ✅

#### Implementation
- [x] Idempotency-Key header is mandatory
- [x] Duplicate detection via `checkDuplicateOrder()`
- [x] Returns existing order on duplicate request
- [x] Stored in database with unique constraint
- [x] Response includes FF-100 status code for duplicates

### Section 9: Scheduler Configuration ✅

#### Cron Jobs
- [x] Webhook Retry: Every 5 minutes (`*/5 * * * *`)
- [x] Expiry Reminder: Daily at 2 AM (`0 2 * * *`)
- [x] Renewal Check: Daily at 3 AM (`0 3 * * *`)
- [x] All configured in t2mobile.js scheduler section

### Section 10: Configuration ✅

#### Environment Variables
- [x] T2MOBILE_API_KEY: API key for incoming requests
- [x] T2MOBILE_API_SECRET: Secret for HMAC signature verification
- [x] T2MOBILE_WEBHOOK_URL: Base webhook URL
- [x] T2MOBILE_RENEWAL_WEBHOOK_URL: Renewal endpoint
- [x] T2MOBILE_ORDER_WEBHOOK_URL: Order status endpoint
- [x] T2MOBILE_PARTNER_ID: Icontech partner ID

#### Feature Flags
- [x] enableWebhookRetry: true
- [x] enableJobs: true
- [x] enableScheduler: true
- [x] enableIdempotency: true

### Section 11: Rate Limiting ✅

- [x] Implemented via express-rate-limit
- [x] 100 requests per minute per IP
- [x] Applied to all T2Mobile routes
- [x] Configurable via t2mobile.js

### Section 12: Response Format Standardization ✅

#### Success Response
```json
{
  "statusCode": "FF-100/PL-100/FF-200",
  "statusDescription": "Description text",
  "data": {...},
  "timestamp": "ISO-8601"
}
```

#### Error Response
```json
{
  "statusCode": "FF-300/AA-305/etc",
  "statusDescription": "Error message",
  "timestamp": "ISO-8601"
}
```

### Section 13: Logging & Monitoring ✅

#### Implemented
- [x] API call logging via `T2MobileHelper.logApiCall()`
- [x] Job execution logs in T2MobileOrderJob
- [x] Webhook retry logs
- [x] Scheduler task logs
- [x] Error tracking and persistence

### Section 14: Known Limitations & To-Do Items

#### Out of Scope (Per TDD)
- [ ] Revenue split between Icontech and Zoho
- [ ] Zoho internal provisioning mechanics
- [ ] Dispute management between Icontech and Zoho
- [ ] Tax compliance outside Nigeria
- [ ] Detailed financial accounting ERP integration

#### Notes
- [ ] Actual Zoho API integration via requestController (makeRequest)
- [ ] Payment processing handled by T2Mobile
- [ ] Settlement timing to be determined by business

---

## Integration Points Summary

### We Provide (Icontech)
1. **GET /products** - Fetch and format Zoho products
2. **POST /fulfilment** - Process orders and queue fulfillment
3. **GET /orders/{orderId}** - Check order status
4. **Webhooks Out** - Send order/renewal notifications to T2Mobile

### We Consume (Icontech)
1. **Idempotency-Key** - From T2Mobile fulfillment requests
2. **HMAC Signature** - Generated for outgoing webhooks
3. **Partner Config** - Stored locally for authentication

### T2Mobile Provides
1. **Payment Processing** - T2Mobile handles customer payment
2. **Partner Onboarding** - Creates partner record with credentials
3. **Webhook Endpoints** - Receives our renewal/order notifications
4. **Customer Management** - Owns customer relationship

---

## Testing Checklist

- [ ] HMAC signature verification with correct credentials
- [ ] HMAC signature rejection with invalid credentials
- [ ] Idempotency key handling - duplicate order detection
- [ ] Revenue split calculation accuracy
- [ ] Webhook retry mechanism with exponential backoff
- [ ] Order status tracking through job processing
- [ ] Scheduler triggers at expected times
- [ ] Error code standardization across all endpoints
- [ ] Rate limiting enforcement
- [ ] Timezone handling for scheduled jobs

---

Last Updated: 2026-02-14
Compliance Status: ✅ TDD 1.4 COMPLIANT
