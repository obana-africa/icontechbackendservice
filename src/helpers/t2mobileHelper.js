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
        const required = ['orderId', 'productId', 'customerId', 'customerName', 'customerEmail', 'tenure'];
        const missing = required.filter(field => !payload[field]);

        if (missing.length > 0) {
            return {
                isValid: false,
                error: `Missing required fields: ${missing.join(', ')}`
            };
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(payload.customerEmail)) {
            return {
                isValid: false,
                error: 'Invalid customer email format'
            };
        }

        // Validate tenure format
        const validTenures = ['1_MONTH', '3_MONTHS', '6_MONTHS', '12_MONTHS'];
        if (!validTenures.includes(payload.tenure)) {
            return {
                isValid: false,
                error: `Invalid tenure. Must be one of: ${validTenures.join(', ')}`
            };
        }

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
     * @param {number} statusCode - HTTP status code
     * @returns {object}
     */
    static formatSuccessResponse(data, statusCode = 200) {
        return {
            success: true,
            statusCode,
            data,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Format error response
     * @param {string} message - Error message
     * @param {string} errorCode - Error code
     * @param {number} statusCode - HTTP status code
     * @returns {object}
     */
    static formatErrorResponse(message, errorCode = 'INTERNAL_ERROR', statusCode = 500) {
        return {
            success: false,
            statusCode,
            errorCode,
            message,
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
     * Get T2Mobile partner info
     * @returns {object}
     */
    static getPartnerInfo() {
        return {
            partnerId: process.env.T2MOBILE_PARTNER_ID || 'ICONTECH001',
            // partnerName: 'Icontech',
            // apiVersion: 'v1'
        };
    }
}

module.exports = T2MobileHelper;
