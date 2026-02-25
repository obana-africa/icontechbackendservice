/**
 * Expiry Reminder Job Processor
 * Handles sending subscription expiry reminders to customers via T2Mobile
 */

const db = require('../models');
const WebhookHelper = require('../helpers/webhookHelper');
const { Op } = require('sequelize');

class ExpiryReminderJob {
    /**
     * Process expiry reminder job
     * @param {object} job - Bull job object
     * @returns {Promise<object>}
     */
    static async process(job) {
        console.log('[Expiry Reminder Job] Starting expiry reminder process');

        try {
            const remindersToSend = await this.findExpiringSubscriptions();
            console.log(`[Expiry Reminder Job] Found ${remindersToSend.length} subscriptions to remind`);

            let successful = 0;
            let failed = 0;
            const errors = [];

            for (const fulfillment of remindersToSend) {
                try {
                    const order = await db.t2mobile_orders.findOne({
                        where: { orderId: fulfillment.orderId }
                    });

                    if (!order) {
                        console.warn(`Order not found for fulfillment ${fulfillment.id}`);
                        continue;
                    }

                    const daysUntilExpiry = this.calculateDaysUntilExpiry(fulfillment.expiryDate);

                    // Send reminder webhook
                    await WebhookHelper.sendWebhook('EXPIRY_REMINDER', {
                        activationReference: fulfillment.activationReference,
                        customerEmail: order.customerEmail,
                        amount: 150000, // TODO: Get actual price from product
                        currency: 'NGN',
                        expiryDate: fulfillment.expiryDate,
                        daysUntilExpiry
                    });

                    successful++;
                } catch (error) {
                    console.error(`Error sending reminder for fulfillment ${fulfillment.id}:`, error);
                    failed++;
                    errors.push({
                        fulfillmentId: fulfillment.id,
                        error: error.message
                    });
                }
            }

            console.log(`[Expiry Reminder Job] Completed - Sent: ${successful}, Failed: ${failed}`);

            return {
                success: true,
                totalProcessed: remindersToSend.length,
                successful,
                failed,
                errors: errors.length > 0 ? errors : null
            };
        } catch (error) {
            console.error('[Expiry Reminder Job] Fatal error:', error);
            throw error;
        }
    }

    /**
     * Find subscriptions expiring within 7 days
     * @returns {Promise<Array>}
     */
    static async findExpiringSubscriptions() {
        try {
            const today = new Date();
            const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

            const expiringFulfillments = await db.t2mobile_fulfillments.findAll({
                where: {
                    status: 'ACTIVE',
                    expiryDate: {
                        [Op.between]: [today, sevenDaysFromNow]
                    }
                }
            });

            return expiringFulfillments;
        } catch (error) {
            console.error('Error finding expiring subscriptions:', error);
            throw error;
        }
    }

    /**
     * Calculate days until expiry
     * @param {Date} expiryDate - Expiry date
     * @returns {number}
     */
    static calculateDaysUntilExpiry(expiryDate) {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setHours(0, 0, 0, 0);

        const expiry = new Date(expiryDate);
        expiry.setHours(0, 0, 0, 0);

        const timeDiff = expiry.getTime() - tomorrow.getTime();
        const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

        return Math.max(0, dayDiff);
    }
}

module.exports = ExpiryReminderJob;
