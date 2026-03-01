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
const {makeRequest} = require('../controllers/requestController');
const { Axios } = require('axios');

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
            order.status = 'PROCESSING';
            await order.save();

            
            job.progress(50);
            const fulfillmentData = await this.provisionLicense({
                salesOrderId,
                activationReference,
                productId,
                customerId,
                tenure
            });

            
            await db.t2mobile_fulfillments.create({
                orderId,
                activationReference,
                salesOrderId,
                status: 'ACTIVE',
                expiryDate: fulfillmentData.expiryDate,
                zohoResponse: fulfillmentData
            });

            
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
            const token = await db.cache.getZohoInvetoryToken()
            let customerId;
            const AxiosInstance = new Axios({
                baseURL: `https://${t2mobileConfig.zoho.api_domain}`,
                headers: {
                    "Content-Type": "application/json",
                               'Authorization': token,
                               
                            },
                })
                        
                        
            // let isTaken = JSON.parse((await AxiosInstance.request({
            //     url: `/inventory/v1/contacts?organization_id=${t2mobileConfig.zoho.organization_id}&email=${orderData.customerEmail}`,
            //     method: 'get',
            //     timeout: t2mobileConfig.timeouts.zohoApiCall
            //     }
            // )).data);

            
            
            let user = await db.users.findOne({  
                where: {
                    email: orderData.customerEmail,
                    
                }
            });

            let isTaken = user ? true : false
            console.log("Zoho contact search response:", isTaken)
            if (isTaken) {
                customerId = user.contact_id;
            } else {                    
            let newPayLoad = {
            contact_name: orderData.customerName,
            email: orderData.customerEmail,
            phone: orderData.customerPhone,
            // display_name: orderData.customerName
        }

            let resp = await AxiosInstance.request({
                url: `/inventory/v1/contacts?organization_id=${t2mobileConfig.zoho.organization_id}`,
                method: 'post',
                data: JSON.stringify(newPayLoad),
                timeout: t2mobileConfig.timeouts.zohoApiCall
                }
            );
            
            
            let parsedResp = JSON.parse(resp.data)
            console.log("Zoho contact search response:", parsedResp)

            customerId = parsedResp.contact.contact_id
            db.users.create({
                name: orderData.customerName,
                phone: orderData.customerPhone,
                email: orderData.customerEmail,
                contact_id: customerId
            })
            
        }

        
        console.log("Customer ID:", customerId)
            
            const payload = {
                customer_id: customerId,
                // salesorder_number: `SO_${orderData.orderId}`,
                customer_name: orderData.customerName,
                customer_email: orderData.customerEmail,
                line_items: [{
                    item_id: orderData.productId,
                    quantity: 1
                }]
            };
            console.log("Zoho Sales Order payload:", payload)
            // req.body = payload;
            // req.params =  {tenant: 'zoho', endpoint: 'salesorders'}
            // let response = await makeRequest(req, res)

            const response = await AxiosInstance.request({
                url: `/inventory/v1/salesorders?organization_id=${t2mobileConfig.zoho.organization_id}`,
                data: JSON.stringify(payload),
                method: 'post',
                timeout: t2mobileConfig.timeouts.zohoApiCall
                }
            );

            let parsedResponse = JSON.parse(response.data)
            console.log(parsedResponse)
            if (!(parsedResponse.code == 0) || !parsedResponse.salesorder?.salesorder_id) {
                throw new Error('No sales order ID returned from Zoho');
            }

            return parsedResponse;
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

 
}

module.exports = T2MobileOrderJob;
