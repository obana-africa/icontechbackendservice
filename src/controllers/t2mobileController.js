/**
 * T2Mobile Controller
 * Handles API endpoints for T2Mobile integration:
 * - GET /products - Fetch product catalogue
 * - POST /fulfilment - Receive and process orders
 */

const db = require('../models');
const T2MobileHelper = require('../helpers/t2mobileHelper');
const WebhookHelper = require('../helpers/webhookHelper');
const JobHelper = require('../helpers/jobHelper');
const t2mobileConfig = require('../config/t2mobile');
const T2MobileOrderJob = require('../jobs/t2mobileOrderJob');
const { v4: uuidv4 } = require('uuid');
const {makeRequest} = require('./requestController')
class T2MobileController {
      /**
     * Fetch products from Zoho (with caching)
     * TODO: Implement actual Zoho API integration
     */
    static async fetchProductsFromZoho(req, res) {
        req.body.return = 1;
        req.params =  {tenant: 'zoho', endpoint: 'get-products'}
        let response = await makeRequest(req, res)
        let products  = [];
        for (const item of response.items) {
            products.push({
                productId: item.item_id,
                name: item.name,
                description: item.description,
                cost: item.rate,
                currency: item.cf_currency,
                tenure: item.cf_tenure,
                imageUrl: item.cf_image_url,
                fulfilmentId: `${item.item_id}_LICENSE`
            })
        }
        
        return products;
        /* [
            {
                productId: 'ZOHO_CRM_STD',
                name: 'Zoho CRM Standard',
                description: 'Professional CRM for small business',
                cost: 150000,
                currency: 'NGN',
                tenure: '12_MONTHS',
                imageUrl: 'https://icontech.com/images/zoho-crm.png',
                fulfilmentId: 'CRM_LICENSE_STD'
            },
            {
                productId: 'ZOHO_BOOKS_PRO',
                name: 'Zoho Books Pro',
                description: 'Accounting software for growing businesses',
                cost: 90000,
                currency: 'NGN',
                tenure: '12_MONTHS',
                imageUrl: 'https://icontech.com/images/zoho-books.png',
                fulfilmentId: 'BOOKS_LICENSE_PRO'
            }
        ]; */
    }
    /**
     * GET /products
     * Fetch products from Zoho Inventory formatted for T2Mobile
     */
    static async getProducts(req, res) {
        try {
            
            const bearerToken = T2MobileHelper.extractBearerToken(req.headers.authorization);
            // if (!bearerToken || !T2MobileHelper.validateApiKey(bearerToken)) {
            //     return res.status(401).json(
            //         T2MobileHelper.formatErrorResponse(
            //             'Unauthorized: Invalid API key',
            //             'INVALID_API_KEY',
            //             401
            //         )
            //     );
            // }

            
            const validation = T2MobileHelper.validateProductsQuery(req.query);
            if (!validation.isValid) {
                return res.status(400).json(
                    T2MobileHelper.formatErrorResponse(validation.error, 'INVALID_QUERY', 400)
                );
            }


            const products = await T2MobileController.fetchProductsFromZoho(req, res);

            
            const response = {
                ...T2MobileHelper.getPartnerInfo(),
                products
            };

            
            await T2MobileHelper.logApiCall({
                endpoint: 'GET /products',
                timestamp: new Date(),
                status: 'success',
                productsCount: products.length
            });

            return res.status(200).json({
                success: true,
                data: response
            });
        } catch (error) {
            console.error('Error fetching products:', error);

            return res.status(500).json(
                T2MobileHelper.formatErrorResponse(
                    'Internal server error',
                    'INTERNAL_ERROR',
                    500
                )
            );
        }
    }

    /**
     * POST /fulfilment
     * Receive order from T2Mobile and queue for processing
     */
    static async createFulfillment(req, res) {
        try {
            // Step 1: Validate API key
            const bearerToken = T2MobileHelper.extractBearerToken(req.headers.authorization);
            // if (!bearerToken || !T2MobileHelper.validateApiKey(bearerToken)) {
            //     return res.status(401).json(
            //         T2MobileHelper.formatErrorResponse(
            //             'Unauthorized: Invalid API key',
            //             'INVALID_API_KEY',
            //             401
            //         )
            //     );
            // }

            // Step 2: Extract and validate idempotency key
            const idempotencyKey = req.headers['idempotency-key'];
            if (!idempotencyKey) {
                return res.status(400).json(
                    T2MobileHelper.formatErrorResponse(
                        'Missing Idempotency-Key header',
                        'MISSING_IDEMPOTENCY_KEY',
                        400
                    )
                );
            }

            // Step 3: Check for duplicate order
            if (t2mobileConfig.features.enableIdempotency) {
                const existingOrder = await T2MobileHelper.checkDuplicateOrder(idempotencyKey);
                if (existingOrder) {
                    console.log(`Duplicate order detected: ${existingOrder.orderId}`);
                    
                    return res.status(200).json({
                        success: true,
                        isDuplicate: true,
                        orderId: existingOrder.orderId,
                        status: existingOrder.status,
                        activationReference: existingOrder.activationReference,
                        salesOrderId: existingOrder.zohoSalesOrderId
                    });
                }
            }

            // Step 4: Validate payload
            const payloadValidation = T2MobileHelper.validateFulfillmentPayload(req.body);
            if (!payloadValidation.isValid) {
                return res.status(400).json(
                    T2MobileHelper.formatErrorResponse(
                        payloadValidation.error,
                        'INVALID_PAYLOAD',
                        400
                    )
                );
            }

            const {
                orderId,
                productId,
                customerId,
                customerName,
                customerEmail,
                customerPhone,
                tenure,
                orderDate
            } = req.body;

            // Step 5: Create order record in database
            const order = await db.t2mobile_orders.create({
                orderId,
                customerId,
                customerName,
                customerEmail,
                customerPhone: customerPhone || null,
                productId,
                tenure,
                status: 'PENDING',
                idempotencyKey,
                orderDate: orderDate ? new Date(orderDate) : null,
                metadata: {
                    api_version: t2mobileConfig.features.enableIdempotency ? 'v1' : 'legacy'
                }
            });

            // Step 6: Queue async job for processing
            if (t2mobileConfig.features.enableJobs) {
                const jobResult = await JobHelper.addJob(
                    JobHelper.QUEUES.T2MOBILE_ORDER,
                    {
                        orderId,
                        productId,
                        customerId,
                        customerName,
                        customerEmail,
                        customerPhone,
                        tenure,
                        idempotencyKey
                    },
                    {
                        attempts: 3,
                        backoff: {
                            type: 'exponential',
                            delay: 2000
                        }
                    }
                );

                console.log(`Order ${orderId} queued for processing - Job ID: ${jobResult.jobId}`);
            } else {
                try {
                    await T2MobileOrderJob.process({ data: req.body });
                } catch (error) {
                    console.error('Synchronous order processing failed:', error);
                    order.status = 'FAILED';
                    order.errorMessage = error.message;
                    await order.save();
                }
            }

            // Step 7: Return immediate response (202 Accepted)
            await T2MobileHelper.logApiCall({
                endpoint: 'POST /fulfilment',
                timestamp: new Date(),
                orderId,
                status: 'accepted'
            });

            return res.status(202).json({
                success: true,
                orderId,
                status: 'PROCESSING',
                activationReference: `${productId}_${orderId}`,
                message: 'Order received and processing'
            });
        } catch (error) {
            console.error('Error creating fulfillment:', error);

            return res.status(500).json(
                T2MobileHelper.formatErrorResponse(
                    error.message || 'Internal server error',
                    'INTERNAL_ERROR',
                    500
                )
            );
        }
    }

    /**
     * Get order status
     * Endpoint for T2Mobile to check order processing status
     */
    static async getOrderStatus(req, res) {
        try {
            // Validate API key
            const bearerToken = T2MobileHelper.extractBearerToken(req.headers.authorization);
            if (!bearerToken || !T2MobileHelper.validateApiKey(bearerToken)) {
                return res.status(401).json(
                    T2MobileHelper.formatErrorResponse(
                        'Unauthorized: Invalid API key',
                        'INVALID_API_KEY',
                        401
                    )
                );
            }

            const { orderId } = req.params;

            const order = await db.t2mobile_orders.findOne({
                where: { orderId }
            });

            if (!order) {
                return res.status(404).json(
                    T2MobileHelper.formatErrorResponse(
                        'Order not found',
                        'ORDER_NOT_FOUND',
                        404
                    )
                );
            }

            return res.status(200).json({
                success: true,
                data: {
                    orderId: order.orderId,
                    status: order.status,
                    activationReference: order.activationReference,
                    salesOrderId: order.zohoSalesOrderId,
                    createdAt: order.createdAt,
                    updatedAt: order.updatedAt
                }
            });
        } catch (error) {
            console.error('Error getting order status:', error);

            return res.status(500).json(
                T2MobileHelper.formatErrorResponse(
                    'Internal server error',
                    'INTERNAL_ERROR',
                    500
                )
            );
        }
    }

  
}

module.exports = T2MobileController;
