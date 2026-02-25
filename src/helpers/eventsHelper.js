const { sendRequest } = require('../helpers/sendRequestHelper')
const { validateRequest, getTenantAndEndpoint } = require('../helpers/requestValidator')

const db = require('../models')
const util = require('../../utils.js')

const utils = require('../../utils.js')
const nodemailer = require('../mailer/nodemailer.js')

class EventstHelper {

    requestDetails

    constructor(requestDetails) {
        this.requestDetails = requestDetails
       
    }

        getCategoryTree = async () => {

        this.requestDetails.headers.Authorization = await this.getZohoInvetoryToken()
    }



    getZohoInvetoryToken = async () => {
        let token = await db.cache.getZohoInvetoryToken()
        return token;
    }



    getZohoSalesOrderToken = async () => {
        let token = await db.cache.getZohoSalesOrderToken()
        return token;
    }

    getZohoBookToken = async () => {
        let token = await db.cache.zohoBookToken()
        return token;
    }

// after_execute of checkout
createZohoOrder = async () => {
    const userControler = require("../controllers/userController.js")
    const zohoOrder = JSON.parse(this.requestDetails.response)
    const user = util.flattenObj(this.requestDetails.req.user)
    const isAgent = user.account_types.split(',').includes('agent')
    
    if (!zohoOrder.salesorder?.salesorder_id) {
        throw this.requestDetails.res.status(406).send({ 
            "measage": zohoOrder?.message ?? zohoOrder, 
            code: zohoOrder?.code ?? 406 
        })
    }
    
    const cart = await db.carts.findOne({ where: { user_id: user.id } })
    cart.products = JSON.stringify([])
    await cart.save()

    let reqQuery = this.requestDetails.req.query
    let savedOrderId = this.requestDetails.req.query.orderId
    let order = await db.orders.findOne({ where: { id: savedOrderId } })

    let agentDetails = isAgent ? this.requestDetails.user : null
    if (!isAgent) {
        const customerAgent = order.agent_id ? 
            utils.flattenObj(await userControler.getUser(null, null, true, null, null, order.agent_id)) : null
        const isCustomerAgent = customerAgent ? 
            customerAgent.account_types.split(',').includes('agent') : null
        agentDetails = isCustomerAgent ? customerAgent : null
    }
    
    const rate = JSON.parse(order?.currency ?? "{}")?.rate
    const commission = agentDetails ? 
        await walletController.createCommision(zohoOrder?.salesorder, agentDetails, rate) : null

    order.order_id = zohoOrder.salesorder?.salesorder_id
    order.commission = commission
    order.order_ref = zohoOrder?.salesorder?.salesorder_number
    
    let shipmentIds = [];
    let shipmentDetailPayload = JSON.parse(order.shipment_details);
    
    if (reqQuery?.deliveryMethod == "shipment" && 
        reqQuery?.paymentMethod == "POD" && 
        reqQuery?.pickUpMethod !== "fulfilment_centre") {
        
        if (shipmentDetailPayload.isMultiVendor) {
            // Multi-vendor: create shipment per vendor group
            for (let vendorGroup of shipmentDetailPayload.parcel.items) {
                // Step 1: Create shipment
                this.requestDetails.req.params.tenant = "terminalAfrica";
                this.requestDetails.req.params.endpoint = 'shipment';
                
                this.requestDetails.req.body = { 
                    pickup_address: {
                        ...vendorGroup.pickup_address,
                        // Add required fields if missing
                        first_name: vendorGroup.pickup_address.first_name || "Vendor",
                        last_name: vendorGroup.pickup_address.last_name || "Store",
                        email: vendorGroup.pickup_address.email || "vendor@store.com",
                        phone: vendorGroup.pickup_address.phone || "+2348090335245",
                        is_residential: false,
                        line2: vendorGroup.pickup_address.line2 || "",
                        zip: vendorGroup.pickup_address.zip || "100001"
                    },
                    delivery_address: shipmentDetailPayload.delivery_address,
                    currency: shipmentDetailPayload.currency,
                    shipment_purpose: "commercial",
                    parcel: { 
                        description: `Package delivery for ${shipmentDetailPayload?.delivery_address?.first_name ?? 'Customer'}`, 
                        weight_unit: "kg", 
                        items: vendorGroup.items.map(item => ({
                            name: item.name,
                            description: item.description || item.name,
                            currency: "NGN",
                            value: item.value || item.total_price,
                            quantity: item.quantity || 1,
                            weight: item.weight || 1
                        }))
                    } 
                };
                
                const { tenant, endpoint } = await getTenantAndEndpoint(this.requestDetails.req.params);
                const shipmentRequestDetails = await validateRequest({ 
                    tenant, 
                    endpoint, 
                    req: this.requestDetails.req, 
                    res: this.requestDetails.res 
                });
                
                const shipmentResponse = await sendRequest(shipmentRequestDetails);
                const shipmentData = JSON.parse(shipmentResponse.data);
                const shipmentId = shipmentData?.data?.shipment_id;
                
                console.log(`Created shipment ${shipmentId} for vendor group`);
                
                // Step 2: Arrange pickup with rate_id
                if (shipmentId && vendorGroup.rate_id) {
                    this.requestDetails.req.params.endpoint = 'pickup';
                    this.requestDetails.req.body = {
                        shipment_id: shipmentId,
                        rate_id: vendorGroup.rate_id,
                        purchase_insurance: false
                    };
                    
                    const pickupEndpoint = await db.endpoints.findOne({ 
                        where: { slug: 'pickup', tenant_id: tenant.id }
                    });
                    
                    const pickupRequestDetails = await validateRequest({ 
                        tenant, 
                        endpoint: pickupEndpoint, 
                        req: this.requestDetails.req, 
                        res: this.requestDetails.res 
                    });
                    
                    const pickupResponse = await sendRequest(pickupRequestDetails);
                    console.log(`Arranged pickup for shipment ${shipmentId}`);
                }
                
                shipmentIds.push(shipmentId);
            }
        } else {
            // Single vendor: create one shipment for all items
            const items = shipmentDetailPayload.parcel.items;
            const firstItem = items[0];
            
            // Step 1: Create shipment
            this.requestDetails.req.params.tenant = "terminalAfrica";
            this.requestDetails.req.params.endpoint = 'shipment';
            
            this.requestDetails.req.body = { 
                pickup_address: {
                    ...firstItem.pickup_address,
                    first_name: firstItem.pickup_address.first_name || "Vendor",
                    last_name: firstItem.pickup_address.last_name || "Store",
                    email: firstItem.pickup_address.email || "vendor@store.com",
                    phone: firstItem.pickup_address.phone || "+2348090335245",
                    is_residential: false,
                    line2: firstItem.pickup_address.line2 || "",
                    zip: firstItem.pickup_address.zip || "100001"
                },
                delivery_address: shipmentDetailPayload.delivery_address,
                currency: shipmentDetailPayload.currency,
                shipment_purpose: "commercial",
                parcel: { 
                    description: `Package delivery for ${shipmentDetailPayload?.delivery_address?.first_name ?? 'Customer'}`, 
                    weight_unit: "kg", 
                    items: items.map(item => ({
                        name: item.name,
                        description: item.description || item.name,
                        currency: "NGN",
                        value: item.value || item.total_price,
                        quantity: item.quantity || 1,
                        weight: item.weight || 1
                    }))
                } 
            };
            
            const { tenant, endpoint } = await getTenantAndEndpoint(this.requestDetails.req.params);
            const shipmentRequestDetails = await validateRequest({ 
                tenant, 
                endpoint, 
                req: this.requestDetails.req, 
                res: this.requestDetails.res 
            });
            
            const shipmentResponse = await sendRequest(shipmentRequestDetails);
            const shipmentData = JSON.parse(shipmentResponse.data);
            const shipmentId = shipmentData?.data?.shipment_id;
            
            console.log(`Created single shipment ${shipmentId}`);
            
            // Step 2: Arrange pickup with rate_id
            if (shipmentId && shipmentDetailPayload.rate_id) {
                this.requestDetails.req.params.endpoint = 'pickup';
                this.requestDetails.req.body = {
                    shipment_id: shipmentId,
                    rate_id: shipmentDetailPayload.rate_id,
                    purchase_insurance: false
                };
                
                const pickupEndpoint = await db.endpoints.findOne({ 
                    where: { slug: 'pickup', tenant_id: tenant.id }
                });
                
                const pickupRequestDetails = await validateRequest({ 
                    tenant, 
                    endpoint: pickupEndpoint, 
                    req: this.requestDetails.req, 
                    res: this.requestDetails.res 
                });
                
                const pickupResponse = await sendRequest(pickupRequestDetails);
                console.log(`Arranged pickup for shipment ${shipmentId}`);
            }
            
            shipmentIds.push(shipmentId);
        }
    }
    
    order.shipment_id = shipmentIds.toString();
    console.log("SHIPMENT IDS", order.shipment_id);
    
    // Send Notification
    const customerData = JSON.parse(order.shipment_details).delivery_address;
    if (isAgent) this.agentNotification(order, user, customerData, zohoOrder);
    if (!isAgent) this.shopperNotification(order, user, zohoOrder, agentDetails);
    
    order.processor = reqQuery?.paymentMethod;
    await order.save();
    this.requestDetails.response = { salesorder_id: zohoOrder.salesorder?.salesorder_id };
}


   
}


module.exports.EventstHelper = EventstHelper
