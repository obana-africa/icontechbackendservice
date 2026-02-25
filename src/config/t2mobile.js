/**
 * T2Mobile Configuration
 * Manages credentials and configuration for T2Mobile integration
 */

module.exports = {
    // API Authentication
    apiKey: process.env.T2MOBILE_API_KEY,
    partnerId: process.env.T2MOBILE_PARTNER_ID || 'ICONTECH001',

    // Webhook Configuration
    webhookSecret: process.env.T2MOBILE_WEBHOOK_SECRET,
    webhookUrl: process.env.T2MOBILE_WEBHOOK_URL,

    // Zoho Integration
    zoho: {
        organization_id: process.env.ZOHO_ORGANIZATION_ID,
        api_domain: process.env.ZOHO_API_DOMAIN || 'api.zoho.com',
        token_endpoint: process.env.ZOHO_TOKEN_ENDPOINT || '/oauth/v2/token',
        refresh_token: process.env.INVENTORY_REFRESH_TOKEN,
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        redirect_uri: process.env.ZOHO_REDIRECT_URI
    },

    // Rate Limiting
    rateLimit: {
        windowMs: 60000,  // 1 minute
        maxRequests: 100  // 100 requests per minute
    },

    // Job Queue Configuration
    jobQueue: {
        redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD,
            db: process.env.REDIS_DB || 0
        },
        // Retry configuration
        maxRetries: 5,
        backoffMultiplier: 2,
        initialBackoff: 1000  // ms
    },

    // Scheduler Configuration
    scheduler: {
        // Expiry reminder cron schedule (daily at 2 AM)
        expiryReminderCron: '0 2 * * *',
        // Renewal check cron schedule (daily at 3 AM)
        renewalCheckCron: '0 3 * * *',
        // Webhook retry cron schedule (every 5 minutes)
        webhookRetryCron: '*/5 * * * *'
    },

    // Security
    security: {
        hmacAlgorithm: 'sha256',
        tlsVersion: 'TLSv1.2',
        https: process.env.NODE_ENV === 'production'
    },

    // Timeout values (in milliseconds)
    timeouts: {
        zohoApiCall: 30000,
        webhookCall: 10000,
        jobProcessing: 60000
    },

    // Feature flags
    features: {
        enableWebhookRetry: true,
        enableJobs: true,
        enableScheduler: true,
        enableIdempotency: true
    },

    // Logging
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: 'json',
        maskedFields: ['password', 'apiKey', 'secret', 'token', 'Authorization']
    },

    // Validation
    validation: {
        maxPayloadSize: 1024 * 100,  // 100KB
        allowedTenures: ['1_MONTH', '3_MONTHS', '6_MONTHS', '12_MONTHS'],
        emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        phoneRegex: /^[\d\s\-\+\(\)]+$/
    },

    // Error handling
    errorHandling: {
        defaultStatusCode: 500,
        includeStackTrace: process.env.NODE_ENV !== 'production'
    },

    /**
     * Validate required configuration
     * @throws {Error} if required config is missing
     */
    validateConfig() {
        const required = [
            'apiKey',
            'webhookSecret',
            'webhookUrl',
            'partnerId'
        ];

        const zohoRequired = [
            'organization_id',
            'refresh_token',
            'client_id',
            'client_secret'
        ];

        for (const field of required) {
            if (!this[field]) {
                throw new Error(`Missing required config: T2MOBILE_${field.toUpperCase()}`);
            }
        }

        for (const field of zohoRequired) {
            if (!this.zoho[field]) {
                throw new Error(`Missing required config: ZOHO_${field.toUpperCase()}`);
            }
        }

        console.log('T2Mobile configuration validated successfully');
    }
};
