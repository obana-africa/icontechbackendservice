/**
 * Job Helper
 * Manages BullMQ job queues for async processing
 */

const Queue = require('bull');
const redis = require('redis');

class JobHelper {
    static queues = {};

    /**
     * Initialize a job queue
     * @param {string} queueName - Name of the queue
     * @returns {object} - Bull queue instance
     */
    static initQueue(queueName) {
        if (this.queues[queueName]) {
            return this.queues[queueName];
        }

        let redisConfig;
        if (process.env.NODE_ENV === 'production') {
            redisConfig= process.env.REDIS_URL
            
        }else {
                redisConfig = {
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
            db: process.env.REDIS_DB || 0
        }
    };

        const queue = new Queue(queueName, redisConfig);

        
        queue.on('completed', (job) => {
            console.log(`[${queueName}] Job ${job.id} completed successfully`);
        });

        queue.on('failed', (job, error) => {
            console.error(`[${queueName}] Job ${job.id} failed:`, error.message);
        });

        queue.on('error', (error) => {
            console.error(`[${queueName}] Queue error:`, error);
        });

        this.queues[queueName] = queue;
        return queue;
    }

    /**
     * Add a job to queue
     * @param {string} queueName - Queue name
     * @param {object} data - Job data
     * @param {object} options - Queue options (delay, priority, attempts, etc.)
     * @returns {Promise<object>}
     */
    static async addJob(queueName, data, options = {}) {
        const queue = this.initQueue(queueName);

        const defaultOptions = {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000
            },
            removeOnComplete: true,
            removeOnFail: false
        };

        const jobOptions = { ...defaultOptions, ...options };

        try {
            const job = await queue.add(data, jobOptions);
            console.log(`[${queueName}] Job ${job.id} added`);
            return {
                jobId: job.id,
                status: 'QUEUED'
            };
        } catch (error) {
            console.error(`Error adding job to ${queueName}:`, error);
            throw error;
        }
    }

    /**
     * Process jobs from a queue
     * @param {string} queueName - Queue name
     * @param {function} processor - Job processor function
     * @param {number} concurrency - Number of concurrent jobs
     */
    static processQueue(queueName, processor, concurrency = 5) {
        const queue = this.initQueue(queueName);
        queue.process(concurrency, processor);
        console.log(`Queue processor started for ${queueName}`);
    }

    /**
     * Get job status
     * @param {string} queueName - Queue name
     * @param {string} jobId - Job ID
     * @returns {Promise<object|null>}
     */
    static async getJobStatus(queueName, jobId) {
        const queue = this.initQueue(queueName);
        const job = await queue.getJob(jobId);

        if (!job) {
            return null;
        }

        return {
            id: job.id,
            status: await job.getState(),
            progress: job.progress(),
            attempts: job.attemptsMade,
            data: job.data
        };
    }

    /**
     * Get queue stats
     * @param {string} queueName - Queue name
     * @returns {Promise<object>}
     */
    static async getQueueStats(queueName) {
        const queue = this.initQueue(queueName);

        const counts = await queue.getJobCounts();
        return {
            queue: queueName,
            ...counts
        };
    }

    /**
     * Clear failed jobs
     * @param {string} queueName - Queue name
     * @returns {Promise<number>}
     */
    static async clearFailedJobs(queueName) {
        const queue = this.initQueue(queueName);
        const failedJobs = await queue.getFailed();
        const count = failedJobs.length;

        for (const job of failedJobs) {
            await job.remove();
        }

        console.log(`Cleared ${count} failed jobs from ${queueName}`);
        return count;
    }

    /**
     * Retry a failed job
     * @param {string} queueName - Queue name
     * @param {string} jobId - Job ID
     * @returns {Promise<boolean>}
     */
    static async retryJob(queueName, jobId) {
        const queue = this.initQueue(queueName);
        const job = await queue.getJob(jobId);

        if (!job) {
            return false;
        }

        await job.retry();
        return true;
    }

    /**
     * Get all queues
     * @returns {object}
     */
    static getQueues() {
        return this.queues;
    }

    /**
     * Close all queues
     * @returns {Promise<void>}
     */
    static async closeQueues() {
        for (const [name, queue] of Object.entries(this.queues)) {
            await queue.close();
            console.log(`Queue ${name} closed`);
        }
        this.queues = {};
    }
}

// Queue names constants
JobHelper.QUEUES = {
    T2MOBILE_ORDER: 't2mobile-orders',
    WEBHOOK_RETRY: 'webhook-retries',
    COMPLIANCE_CHECK: 'compliance-checks',
    EXPIRY_REMINDER: 'expiry-reminders'
};

module.exports = JobHelper;
