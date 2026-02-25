/**
 * Webhook Retry Job Processor
 * Handles retrying failed webhooks sent to T2Mobile
 */

const WebhookHelper = require('../helpers/webhookHelper');

class WebhookRetryJob {
    /**
     * Process webhook retry job
     * @param {object} job - Bull job object
     * @returns {Promise<object>}
     */
    static async process(job) {
        console.log('[Webhook Retry Job] Starting webhook retry process');

        try {
            const result = await WebhookHelper.retryFailedWebhooks();

            console.log('[Webhook Retry Job] Retry completed:', result);

            return {
                success: true,
                processed: result.processed,
                successful: result.successful,
                failed: result.failed
            };
        } catch (error) {
            console.error('[Webhook Retry Job] Error during retry:', error);
            throw error;
        }
    }
}

module.exports = WebhookRetryJob;
