/**
 * T2Mobile Order Job Processor
 * Handles async processing of new orders from T2Mobile
 * - Create Zoho Sales Order
 * - Provision license
 * - Send webhook notification
 */

const axios = require('axios');
const db = require('../models');
const WebhookHelper = require('../helpers/webhookHelper');
const T2MobileHelper = require('../helpers/t2mobileHelper');
const t2mobileConfig = require('../config/t2mobile');

class T2MobileOrderJob {
    /**
     * Process order job
     * @param {object} job - Bull job object
     * @returns {Promise<object>}
     */
    static async process(job) {
        const {
            orderId,
            productId,
            customerId,
            customerName,
            customerEmail,
            customerPhone,
            tenure,
            idempotencyKey
        } = job.data;

        console.log(`[T2Mobile Order Job] Processing order: ${orderId}`);

        try {
            
            const order = await db.t2mobile_orders.findOne({
                where: { orderId }
            });

            if (!order) {
                throw new Error('Order not found in database');
            }

            
            job.progress(25);
            const zohoSalesOrderResponse = await this.createZohoSalesOrder({
                productId,
                customerName,
                customerEmail,
                customerPhone,
                tenure,
                orderId
            });

            const salesOrderId = zohoSalesOrderResponse.code;
            const activationReference = `${productId}_${orderId}`;

            
            order.zohoSalesOrderId = salesOrderId;
            order.activationReference = activationReference;
            order.status = 'FULFILLING';
            await order.save();

            
            job.progress(50);
            const fulfillmentData = await this.provisionLicense({
                salesOrderId,
                activationReference,
                productId,
                customerId,
                tenure
            });

            // Step 5: Create fulfillment record
            await db.t2mobile_fulfillments.create({
                orderId,
                activationReference,
                salesOrderId,
                status: 'ACTIVE',
                expiryDate: fulfillmentData.expiryDate,
                zohoResponse: fulfillmentData
            });

            // Step 6: Update order status to FULFILLED
            order.status = 'FULFILLED';
            await order.save();

            // Step 7: Send success webhook to T2Mobile
            job.progress(75);
            const webhookResult = await WebhookHelper.sendWebhook('ORDER_FULFILLED', {
                orderId,
                activationReference,
                salesOrderId,
                expiryDate: fulfillmentData.expiryDate
            });

            console.log(`[T2Mobile Order Job] Order ${orderId} fulfilled successfully`);
            job.progress(100);

            return {
                success: true,
                orderId,
                salesOrderId,
                activationReference,
                webhookSent: webhookResult.success
            };
        } catch (error) {
            console.error(`[T2Mobile Order Job] Error processing order ${orderId}:`, error);

            // Update order status to FAILED
            const order = await db.t2mobile_orders.findOne({
                where: { orderId }
            });

            if (order) {
                order.status = 'FAILED';
                order.errorMessage = error.message;
                await order.save();
            }

            // Send failure webhook
            try {
                await WebhookHelper.sendWebhook('ORDER_FAILED', {
                    orderId,
                    errorCode: error.code || 'PROVISIONING_FAILED',
                    message: error.message
                });
            } catch (webhookError) {
                console.error('Failed to send failure webhook:', webhookError);
            }

            throw error; // Re-throw for Bull to handle retry
        }
    }

    /**
     * Create Sales Order in Zoho
     * @param {object} orderData - Order details
     * @returns {Promise<object>}
     */
    static async createZohoSalesOrder(orderData) {
        try {
            // Get Zoho token
            const token = await this.getZohoToken();

            const payload = {
                customer_name: orderData.customerName,
                customer_email: orderData.customerEmail,
                line_items: [{
                    item_id: orderData.productId,
                    quantity: 1
                }]
            };

            const response = await axios.post(
                `https://${t2mobileConfig.zoho.api_domain}/inventory/api/v1/salesorders`,
                payload,
                {
                    headers: {
                        'Authorization': `Zoho-oauthtoken ${token}`,
                        'X-com-zoho-invoice-organizationid': t2mobileConfig.zoho.organization_id
                    },
                    timeout: t2mobileConfig.timeouts.zohoApiCall
                }
            );

            if (!response.data.code) {
                throw new Error('No sales order ID returned from Zoho');
            }

            return response.data;
        } catch (error) {
            const { errorMessage, errorCode } = T2MobileHelper.parseZohoError(error);
            const err = new Error(`Zoho Sales Order creation failed: ${errorMessage}`);
            err.code = errorCode;
            throw err;
        }
    }

    /**
     * Provision license in Zoho
     * @param {object} provisionData - Provisioning details
     * @returns {Promise<object>}
     */
    static async provisionLicense(provisionData) {
        try {
            // In a real scenario, this would interact with Zoho Subscriptions API
            // or a custom provisioning service

            const tenureMonths = parseInt(provisionData.tenure.split('_')[0]);
            const expiryDate = new Date();
            expiryDate.setMonth(expiryDate.getMonth() + tenureMonths);

            return {
                activationReference: provisionData.activationReference,
                status: 'ACTIVE',
                expiryDate: expiryDate.toISOString(),
                provisioned_at: new Date().toISOString()
            };
        } catch (error) {
            throw new Error(`License provisioning failed: ${error.message}`);
        }
    }

    /**
     * Get Zoho OAuth token
     * @returns {Promise<string>}
     */
    static async getZohoToken() {
        try {
            // This should ideally cache the token and refresh when expired
            const response = await axios.post(
                `https://${t2mobileConfig.zoho.api_domain}${t2mobileConfig.zoho.token_endpoint}`,
                {
                    grant_type: 'refresh_token',
                    client_id: t2mobileConfig.zoho.client_id,
                    client_secret: t2mobileConfig.zoho.client_secret,
                    refresh_token: t2mobileConfig.zoho.refresh_token
                },
                { timeout: t2mobileConfig.timeouts.zohoApiCall }
            );

            return response.data.access_token;
        } catch (error) {
            throw new Error('Failed to obtain Zoho token: ' + error.message);
        }
    }
}

module.exports = T2MobileOrderJob;
