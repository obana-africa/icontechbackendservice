/**
 * Webhook Helper
 * Handles webhook signing, sending, and retry logic
 */

const axios = require('axios');
const T2MobileHelper = require('./t2mobileHelper');
const db = require('../models');

class WebhookHelper {
    /**
     * Create webhook payload for different event types
     * @param {string} eventType - Event type (ORDER_FULFILLED, etc.)
     * @param {object} data - Event data
     * @returns {object}
     */
    static createWebhookPayload(eventType, data) {
        const basePayload = {
            eventType,
            timestamp: new Date().toISOString()
        };

        switch (eventType) {
            case 'ORDER_FULFILLED':
                return {
                    ...basePayload,
                    orderId: data.orderId,
                    activationReference: data.activationReference,
                    salesOrderId: data.salesOrderId,
                    status: 'SUCCESS',
                    expiryDate: data.expiryDate
                };

            case 'ORDER_FAILED':
                return {
                    ...basePayload,
                    orderId: data.orderId,
                    status: 'FAILED',
                    errorCode: data.errorCode,
                    message: data.message
                };

            case 'SUBSCRIPTION_RENEWED':
                return {
                    ...basePayload,
                    orderId: data.orderId,
                    activationReference: data.activationReference,
                    newExpiryDate: data.newExpiryDate
                };

            case 'EXPIRY_REMINDER':
                return {
                    ...basePayload,
                    activationReference: data.activationReference,
                    customerEmail: data.customerEmail,
                    amount: data.amount,
                    currency: data.currency || 'NGN',
                    expiryDate: data.expiryDate,
                    daysUntilExpiry: data.daysUntilExpiry
                };

            default:
                return basePayload;
        }
    }

    /**
     * Send webhook to T2Mobile
     * @param {string} eventType - Event type
     * @param {object} data - Event data
     * @param {boolean} saveLog - Whether to save webhook log to DB
     * @returns {Promise<object>}
     */
    static async sendWebhook(eventType, data, saveLog = true) {
        const webhookUrl = process.env.T2MOBILE_WEBHOOK_URL;
        if (!webhookUrl) {
            console.error('T2MOBILE_WEBHOOK_URL not configured');
            throw new Error('Webhook URL not configured');
        }

        const payload = this.createWebhookPayload(eventType, data);
        const signature = T2MobileHelper.generateWebhookSignature(payload);

        const webhookLog = {
            eventType,
            orderId: data.orderId || null,
            activationReference: data.activationReference || null,
            payload,
            status: 'PENDING',
            retries: 0
        };

        try {
            // Send webhook
            const response = await axios.post(webhookUrl, payload, {
                headers: {
                    'X-Webhook-Signature': signature,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            webhookLog.status = 'SENT';
            webhookLog.response = response.data;
            webhookLog.httpStatusCode = response.status;
            webhookLog.sentAt = new Date();

            if (saveLog) {
                await db.t2mobile_webhook_logs.create(webhookLog);
            }

            return {
                success: true,
                webhookId: webhookLog.id,
                message: 'Webhook sent successfully'
            };
        } catch (error) {
            webhookLog.status = 'FAILED';
            webhookLog.lastError = error.message;
            webhookLog.httpStatusCode = error.response?.status || null;

            if (saveLog) {
                // Schedule retry
                webhookLog.nextRetryAt = new Date(
                    Date.now() + T2MobileHelper.calculateExponentialBackoff(1)
                );
                await db.t2mobile_webhook_logs.create(webhookLog);
            }

            console.error('Webhook send failed:', {
                eventType,
                error: error.message,
                orderId: data.orderId
            });

            return {
                success: false,
                error: error.message,
                shouldRetry: true
            };
        }
    }

    /**
     * Retry failed webhooks from database
     * @returns {Promise<object>}
     */
    static async retryFailedWebhooks() {
        try {
            const failedWebhooks = await db.t2mobile_webhook_logs.findAll({
                where: {
                    status: ['FAILED', 'RETRYING'],
                    nextRetryAt: {
                        [db.Sequelize.Op.lte]: new Date()
                    },
                    retries: {
                        [db.Sequelize.Op.lt]: 5  
                    }
                }
            });

            let successful = 0;
            let failed = 0;

            for (const webhook of failedWebhooks) {
                try {
                    const signature = T2MobileHelper.generateWebhookSignature(webhook.payload);

                    const response = await axios.post(
                        process.env.T2MOBILE_WEBHOOK_URL,
                        webhook.payload,
                        {
                            headers: {
                                'X-Webhook-Signature': signature,
                                'Content-Type': 'application/json'
                            },
                            timeout: 10000
                        }
                    );

                    webhook.status = 'SENT';
                    webhook.response = response.data;
                    webhook.httpStatusCode = response.status;
                    webhook.sentAt = new Date();
                    webhook.retries += 1;
                    await webhook.save();

                    successful++;
                } catch (error) {
                    webhook.retries += 1;
                    webhook.status = 'RETRYING';
                    webhook.lastError = error.message;
                    webhook.nextRetryAt = new Date(
                        Date.now() + T2MobileHelper.calculateExponentialBackoff(webhook.retries)
                    );
                    await webhook.save();

                    failed++;
                }
            }

            return {
                processed: failedWebhooks.length,
                successful,
                failed
            };
        } catch (error) {
            console.error('Error retrying webhooks:', error);
            throw error;
        }
    }

    /**
     * Log webhook event for audit trail
     * @param {object} logData - Log details
     */
    static async logWebhookEvent(logData) {
        try {
            // Implement comprehensive logging
            console.log('[Webhook Event]', JSON.stringify(logData, null, 2));
            
            // Optionally store in external logging service
            // e.g., CloudWatch, Datadog, etc.
        } catch (error) {
            console.error('Error logging webhook event:', error);
        }
    }

    /**
     * Format webhook response for logging
     * @param {object} webhook - Webhook log record
     * @returns {object}
     */
    static formatWebhookLogResponse(webhook) {
        return {
            id: webhook.id,
            eventType: webhook.eventType,
            orderId: webhook.orderId,
            status: webhook.status,
            retries: webhook.retries,
            nextRetryAt: webhook.nextRetryAt,
            createdAt: webhook.createdAt,
            sentAt: webhook.sentAt
        };
    }
}

module.exports = WebhookHelper;
