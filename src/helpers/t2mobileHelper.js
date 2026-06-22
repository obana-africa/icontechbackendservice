/**
 * T2Mobile Helper
 * Handles API key validation, HMAC signing, payload validation, and utility functions
 */

const crypto = require('crypto');
const db = require('../models');

class T2MobileHelper {
    /**
     * Validate T2Mobile API key
     * @param {string} apiKey - API key from Authorization header
     * @returns {boolean}
     */
    static validateApiKey(apiKey) {
        // In production, validate against database or secure config
        // For now, compare with environment variable
        const validKey = process.env.T2MOBILE_API_KEY;
        if (!validKey) {
            console.error('T2MOBILE_API_KEY not configured');
            return false;
        }
        return apiKey === validKey;
    }

    /**
     * Extract Bearer token from Authorization header
     * @param {string} authHeader - Authorization header value
     * @returns {string|null}
     */
    static extractBearerToken(authHeader) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }
        return authHeader.substring(7);
    }

    /**
     * Validate request payload structure
     * @param {object} payload - Request body
     * @returns {object} - { isValid: boolean, error: string|null }
     */
    static validateFulfillmentPayload(payload) {
const {
        orderId,
        product,
        customer
    } = payload || {};

    const missing = [];

    // top-level
    if (!orderId) missing.push('orderId');

    // product fields
    if (!product?.externalProductId) {
        missing.push('product.externalProductId');
    }

    if (!product?.tenureDays) {
        missing.push('product.tenureDays');
    }

    // customer fields
    if (!customer?.email) {
        missing.push('customer.email');
    }

    if (!customer?.firstName) {
        missing.push('customer.firstName');
    }

    if (!customer?.lastName) {
        missing.push('customer.lastName');
    }

    if (!customer?.phone) {
        missing.push('customer.phone');
    }

    // missing fields response
    if (missing.length > 0) {
        return {
            isValid: false,
            error: `Missing required fields: ${missing.join(', ')}`
        };
    }

    // validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(customer.email)) {
        return {
            isValid: false,
            error: 'Invalid customer email format'
        };
    }

        // Validate tenure format
        // const validTenures = ['1_MONTH', '3_MONTHS', '6_MONTHS', '12_MONTHS'];
        // if (!validTenures.includes(payload.tenure)) {
        //     return {
        //         isValid: false,
        //         error: `Invalid tenure. Must be one of: ${validTenures.join(', ')}`
        //     };
        // }

        return { isValid: true, error: null };
    }

    /**
     * Validate products payload structure
     * @param {object} query - Query parameters
     * @returns {object} - { isValid: boolean, error: string|null }
     */
    static validateProductsQuery(query) {
        // Add any query validation here if needed
        return { isValid: true, error: null };
    }

    /**
     * Check for duplicate order by idempotency key
     * @param {string} idempotencyKey - Unique request ID
     * @returns {Promise<object|null>}
     */
    static async checkDuplicateOrder(idempotencyKey) {
        try {
            const existingOrder = await db.t2mobile_orders.findOne({
                where: { idempotencyKey }
            });
            return existingOrder;
        } catch (error) {
            console.error('Error checking duplicate order:', error);
            throw error;
        }
    }

    /**
     * Sign webhook payload with HMAC-SHA256
     * @param {object} payload - Payload to sign
     * @param {string} secret - Webhook secret (from T2Mobile)
     * @returns {string} - HMAC signature
     */
    static signWebhookPayload(payload, secret) {
        const payloadString = JSON.stringify(payload);
        const signature = crypto
            .createHmac('sha256', secret)
            .update(payloadString, 'utf8')
            .digest('hex');
        return signature;
    }

    /**
     * Verify webhook signature (for incoming webhooks from T2Mobile)
     * @param {object} payload - Received payload
     * @param {string} signature - Signature from header
     * @param {string} secret - Webhook secret
     * @returns {boolean}
     */
    static verifyWebhookSignature(payload, signature, secret) {
        const computedSignature = this.signWebhookPayload(payload, secret);
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(computedSignature)
        );
    }

    /**
     * Generate HMAC signature header value
     * @param {object} payload - Payload to sign
     * @returns {string} - HMAC signature
     */
    static generateWebhookSignature(payload) {
        const webhookSecret = process.env.T2MOBILE_WEBHOOK_SECRET;
        if (!webhookSecret) {
            throw new Error('T2MOBILE_WEBHOOK_SECRET not configured');
        }
        return this.signWebhookPayload(payload, webhookSecret);
    }

    /**
     * Format success response
     * @param {object} data - Response data
     * @param {string} statusCode - Standardized status code
     * @param {string} statusDescription - Status description
     * @returns {object}
     */
    static formatSuccessResponse(data, statusCode = 'FF-100', statusDescription = 'Success') {
        return {
            statusCode,
            statusDescription,
            data,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Format error response with standardized codes
     * @param {string} message - Error message
     * @param {string} errorCode - Standardized error code from TDD
     * @param {number} statusCode - HTTP status code
     * @returns {object}
     */
    static formatErrorResponse(message, errorCode, statusCode = 500) {
        return {
            statusCode: errorCode,
            statusDescription: message,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Parse Zoho error response
     * @param {object} error - Axios error object
     * @returns {object} - Parsed error
     */
    static parseZohoError(error) {
        let errorMessage = 'Unknown error';
        let errorCode = 'ZOHO_ERROR';

        if (error.response) {
            errorMessage = error.response.data?.message || error.response.statusText;
            errorCode = error.response.data?.code || `HTTP_${error.response.status}`;
        } else if (error.message) {
            errorMessage = error.message;
        }

        return { errorMessage, errorCode };
    }

    /**
     * Log API call for debugging/audit
     * @param {object} logData - Log details
     */
    static async logApiCall(logData) {
        try {
            // Store in database or external logging service
            // For now, just console log in production replace with proper logging
            console.log('[T2Mobile API Call]', JSON.stringify(logData, null, 2));
        } catch (error) {
            console.error('Error logging API call:', error);
        }
    }

    /**
     * Calculate exponential backoff delay
     * @param {number} attemptNumber - Current attempt number (1-based)
     * @returns {number} - Delay in milliseconds
     */
    static calculateExponentialBackoff(attemptNumber) {
        // Backoff: 30s, 2min, 5min, 10min, 20min
        const delays = [30000, 120000, 300000, 600000, 1200000];
        return delays[Math.min(attemptNumber - 1, delays.length - 1)];
    }

    /**
     * Verify HMAC signature for incoming requests
     * @param {string} method - HTTP method
     * @param {string} path - Request path (with query)
     * @param {string} timestamp - X-Api-Timestamp
     * @param {string} body - Raw request body
     * @param {string} signature - X-Api-Signature
     * @returns {boolean}
     */
    static verifyHmacSignature(method, path, timestamp, body, signature) {
        const apiSecret = process.env.T2MOBILE_API_SECRET;
        if (!apiSecret) {
            console.error('T2MOBILE_API_SECRET not configured');
            return false;
        }

        // Create string to sign: METHOD\nPATH+QUERY\nTIMESTAMP\nSHA256(body)
        const bodyHash = crypto.createHash('sha256').update(body || '', 'utf8').digest('hex');
        const stringToSign = `${method.toUpperCase()}\n${path}\n${timestamp}\n${bodyHash}`;

        // Generate expected signature
        const expectedSignature = crypto
            .createHmac('sha256', apiSecret)
            .update(stringToSign, 'utf8')
            .digest('base64');

        // Use timing-safe comparison
        try {
            return crypto.timingSafeEqual(
                Buffer.from(signature, 'base64'),
                Buffer.from(expectedSignature, 'base64')
            );
        } catch (error) {
            return false;
        }
    }

    /**
     * Middleware to authenticate T2Mobile requests using HMAC
     * @param {object} req - Express request
     * @param {object} res - Express response
     * @param {function} next - Next middleware
     */
    static authenticateT2MobileRequest(req, res, next) {
        try {
            const apiKey = req.headers['x-api-key'];
            const timestamp = req.headers['x-api-timestamp'];
            const signature = req.headers['x-api-signature'];

            // Check required headers
            if (!apiKey || !timestamp || !signature) {
                return res.status(401).json(
                    this.formatErrorResponse(
                        'Missing required authentication headers',
                        'AA-304',
                        401
                    )
                );
            }

            // Validate API key
            const validKey = process.env.T2MOBILE_API_KEY;
            if (apiKey !== validKey) {
                return res.status(401).json(
                    this.formatErrorResponse(
                        'Invalid API key',
                        'AA-305',
                        401
                    )
                );
            }

            // Check timestamp tolerance (±300 seconds)
            const now = Math.floor(Date.now() / 1000);
            const requestTime = parseInt(timestamp);
            if (Math.abs(now - requestTime) > 300) {
                return res.status(401).json(
                    this.formatErrorResponse(
                        'Request timestamp outside tolerance window',
                        'AA-304',
                        401
                    )
                );
            }

            // Get raw body for signature verification
            const rawBody = req.rawBody || JSON.stringify(req.body);
            const pathWithQuery = req.originalUrl;

            // Verify HMAC signature
            if (!this.verifyHmacSignature(req.method, pathWithQuery, timestamp, rawBody, signature)) {
                return res.status(401).json(
                    this.formatErrorResponse(
                        'Invalid request signature',
                        'AA-305',
                        401
                    )
                );
            }

            // Authentication successful
            next();
        } catch (error) {
            console.error('HMAC authentication error:', error);
            return res.status(500).json(
                T2MobileHelper.formatErrorResponse(
                    'Authentication error',
                    'FF-500',
                    500
                )
            );
        }
    }
}

module.exports = T2MobileHelper;
