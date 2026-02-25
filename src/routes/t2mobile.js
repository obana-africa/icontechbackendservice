/**
 * T2Mobile Routes
 * All API endpoints for T2Mobile integration
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const T2MobileController = require('../controllers/t2mobileController');
const t2mobileConfig = require('../config/t2mobile');

const router = express.Router();

/**
 * Rate limiter middleware for T2Mobile endpoints
 */
const t2mobileRateLimiter = rateLimit({
    windowMs: t2mobileConfig.rateLimit.windowMs,
    max: t2mobileConfig.rateLimit.maxRequests,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in RateLimit-* headers
    legacyHeaders: false,  // Disable X-RateLimit-* headers
    skip: (req) => {
        // Skip rate limiting for health checks or specific paths
        return req.path === '/health';
    }
});

/**
 * @swagger
 * /t2mobile/products:
 *   get:
 *     summary: Get product catalogue
 *     description: Fetch all available Zoho products formatted for T2Mobile
 *     tags:
 *       - T2Mobile
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         required: true
 *         schema:
 *           type: string
 *           example: Bearer {api_key}
 *         description: API Key authentication
 *     responses:
 *       '200':
 *         description: Products returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     partnerId:
 *                       type: string
 *                     products:
 *                       type: array
 *       '401':
 *         description: Unauthorized - Invalid API key
 *       '429':
 *         description: Too many requests
 */
router.get('/:partnerId/products', t2mobileRateLimiter, T2MobileController.getProducts);

/**
 * @swagger
 * /t2mobile/fulfilment:
 *   post:
 *     summary: Create order/fulfillment
 *     description: Submit order after customer payment to create sales order in Zoho
 *     tags:
 *       - T2Mobile
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         required: true
 *         schema:
 *           type: string
 *         description: API Key authentication
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique request ID for idempotency
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *               - productId
 *               - customerId
 *               - customerName
 *               - customerEmail
 *               - tenure
 *             properties:
 *               orderId:
 *                 type: string
 *                 example: T2M123456
 *               productId:
 *                 type: string
 *                 example: ZOHO_CRM_STD
 *               customerId:
 *                 type: string
 *               customerName:
 *                 type: string
 *               customerEmail:
 *                 type: string
 *                 format: email
 *               customerPhone:
 *                 type: string
 *               tenure:
 *                 type: string
 *                 enum:
 *                   - 1_MONTH
 *                   - 3_MONTHS
 *                   - 6_MONTHS
 *                   - 12_MONTHS
 *               orderDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       '202':
 *         description: Order accepted for processing
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 orderId:
 *                   type: string
 *                 status:
 *                   type: string
 *                   example: PROCESSING
 *       '400':
 *         description: Invalid request payload
 *       '401':
 *         description: Unauthorized
 *       '409':
 *         description: Invalid product or duplicate order
 */
router.post('/:partnerId/fulfilment/:fulfilmentId', t2mobileRateLimiter, T2MobileController.createFulfillment);

/**
 * @swagger
 * /t2mobile/orders/{orderId}:
 *   get:
 *     summary: Get order status
 *     description: Check processing status of an order
 *     tags:
 *       - T2Mobile
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID from T2Mobile
 *       - in: header
 *         name: Authorization
 *         required: true
 *         schema:
 *           type: string
 *         description: API Key authentication
 *     responses:
 *       '200':
 *         description: Order status retrieved
 *       '404':
 *         description: Order not found
 *       '401':
 *         description: Unauthorized
 */
router.get('/orders/:orderId', t2mobileRateLimiter, T2MobileController.getOrderStatus);

/**
 * Health check endpoint (not rate limited)
 */
router.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        service: 't2mobile-integration',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
