/**
 * T2Mobile Scheduler
 * Manages cron jobs for periodic tasks using node-cron
 */

const cron = require('node-cron');
const JobHelper = require('../helpers/jobHelper');
const t2mobileConfig = require('../config/t2mobile');
const WebhookRetryJob = require('../jobs/webhookRetryJob');
const ExpiryReminderJob = require('../jobs/expiryReminderJob');

class T2MobileScheduler {
    static tasks = [];

    /**
     * Initialize all cron jobs
     */
    static initialize() {
        if (!t2mobileConfig.features.enableScheduler) {
            console.log('T2Mobile scheduler is disabled');
            return;
        }

        console.log('Starting T2Mobile scheduler...');

        
        this.scheduleWebhookRetry();

        
        this.scheduleExpiryReminder();

        
        this.scheduleRenewalCheck();

        console.log(`T2Mobile scheduler initialized with ${this.tasks.length} tasks`);
    }

    /**
     * Schedule webhook retry job
     * Runs every 5 minutes
     */
    static scheduleWebhookRetry() {
        const cron_expression = t2mobileConfig.scheduler.webhookRetryCron || '*/5 * * * *';

        const task = cron.schedule(cron_expression, async () => {
            console.log('[Scheduler] Running webhook retry job...');
            try {
                const result = await WebhookRetryJob.process({});
                console.log('[Scheduler] Webhook retry completed:', result);
            } catch (error) {
                console.error('[Scheduler] Webhook retry failed:', error);
            }
        });

        this.tasks.push({ name: 'webhook-retry', task });
        console.log(`[Scheduler] Webhook retry scheduled: "${cron_expression}"`);
    }

    /**
     * Schedule expiry reminder job
     * Runs daily at 2 AM
     */
    static scheduleExpiryReminder() {
        const cron_expression = t2mobileConfig.scheduler.expiryReminderCron || '0 2 * * *';

        const task = cron.schedule(cron_expression, async () => {
            console.log('[Scheduler] Running expiry reminder job...');
            try {
                const result = await ExpiryReminderJob.process({});
                console.log('[Scheduler] Expiry reminder completed:', result);
            } catch (error) {
                console.error('[Scheduler] Expiry reminder failed:', error);
            }
        });

        this.tasks.push({ name: 'expiry-reminder', task });
        console.log(`[Scheduler] Expiry reminder scheduled: "${cron_expression}"`);
    }

    /**
     * Schedule renewal check job
     * Runs daily at 3 AM
     */
    static scheduleRenewalCheck() {
        const cron_expression = t2mobileConfig.scheduler.renewalCheckCron || '0 3 * * *';

        const task = cron.schedule(cron_expression, async () => {
            console.log('[Scheduler] Running renewal check job...');
            try {
                await this.checkRenewals();
                console.log('[Scheduler] Renewal check completed');
            } catch (error) {
                console.error('[Scheduler] Renewal check failed:', error);
            }
        });

        this.tasks.push({ name: 'renewal-check', task });
        console.log(`[Scheduler] Renewal check scheduled: "${cron_expression}"`);
    }

    /**
     * Check for renewals that need to be processed
     * (Placeholder for future implementation)
     */
    static async checkRenewals() {
        try {
            // TODO:  renewal checking logic
            // Query fulfillments that are about to expire and need renewal
            console.log('[Scheduler] Renewal check completed');
        } catch (error) {
            console.error('[Scheduler] Error during renewal check:', error);
            throw error;
        }
    }

    /**
     * Stop a specific scheduled task
     * @param {string} taskName - Name of the task to stop
     */
    static stopTask(taskName) {
        const taskIndex = this.tasks.findIndex(t => t.name === taskName);
        if (taskIndex !== -1) {
            this.tasks[taskIndex].task.stop();
            this.tasks.splice(taskIndex, 1);
            console.log(`Task "${taskName}" stopped`);
        }
    }

    /**
     * Stop all scheduled tasks
     */
    static stopAll() {
        for (const { name, task } of this.tasks) {
            task.stop();
            console.log(`Task "${name}" stopped`);
        }
        this.tasks = [];
        console.log('All scheduled tasks stopped');
    }

    /**
     * Get status of all scheduled tasks
     * @returns {Array}
     */
    static getStatus() {
        return this.tasks.map(t => ({
            name: t.name,
            running: !t.task._destroyed
        }));
    }

    /**
     * Restart all scheduled tasks
     */
    static restart() {
        this.stopAll();
        this.initialize();
        console.log('Scheduler restarted');
    }
}

module.exports = T2MobileScheduler;
