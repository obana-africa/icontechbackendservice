const crypto = require('crypto');
const db = require("../models")
const { Op, Utils, or } = require('sequelize')
const { sendRequest } = require('../helpers/sendRequestHelper')
const { validateRequest, getTenantAndEndpoint } = require('../helpers/requestValidator')
 
const { flattenObj } = require('../../utils');
const { check } = require('express-validator');
const utils = require('../../utils');
const e = require('cors');

class WeebHooksHelper {
    log
    constructor(endpoint, req, res, makeRequest) {
        this.endpoint = endpoint
        this.req = req
        this.res = res
        this.makeRequest = makeRequest
    }

    async callMethods() {
        let method = this.endpoint + '()'
        this.log = await db.requests.create({
            originating_route: this.req.originalUrl,
            payload: JSON.stringify(this.req.body)
        })
        try {
            return await eval('this.' + method)
        } catch (error) {
            console.log(error.message)
            this.log.response = JSON.stringify(error)
            await this.log.save()
            return this.res.status(400).send(error.message)
        }

    }
    /**
     * PayStack webhook
     * @returns 
     */
    pstack = async () => {
        const secret = process.env.PAY_STACK_SECRET_KEY
        const hash = crypto.createHmac('sha512', secret).update(JSON.stringify(this.req.body)).digest('hex');
        if (hash !== this.req.headers['x-paystack-signature'])
            return this.res.status(401).send()
        let orderId = this.req.body?.data?.reference
        const request = this.req?.body
        if (request?.data?.status == 'success') {
            const order = await db.orders.findOne({ where: { order_id: orderId } })
            if (order && order.pickUpMethod !== "fulfilment_centre") {
                order.shipment_id = await this.shipOrder(order)
                order.save()
            }
        }
        if (orderId) {
            let status = this.mapWebHookPaymentResponse(request.data.status)
            await this.updateZohoSalesOrder(orderId, status)
        }
        return this.res.status(200).send()
    }

    /**
     * StartButton webhook
     * @returns
     */
    startbutton = async () => {
        try {
            const secret = process.env.STARTBUTTON_WEBHOOK_SECRET;
            const signature = this.req.headers['x-startbutton-signature'];
            const payload = JSON.stringify(this.req.body);
            const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
            if (signature !== expectedSignature) {
                return this.res.status(401).send();
            }

            // Log for debugging

            const { event, data } = this.req.body;
            // Accept both 'payment.success', 'verified', and 'successful' as success events
            const isSuccess = (
                (event === 'payment.success' || event === 'verified' || event === 'successful') &&
                data.status && ['success', 'verified', 'successful'].includes(data.status)
            );

            if (isSuccess) {
                let orderId = data.reference;
                const order = await db.orders.findOne({ where: { order_id: orderId } });
                if (order && order.pickUpMethod !== "fulfilment_centre")  {
                    order.payments = 'paid';
                    order.shipment_id = await this.shipOrder(order);
                    await order.save();
                }
            }
            return this.res.status(200).send();
        } catch (err) {
            console.error('StartButton webhook error:', err);
            return this.res.status(500).send();
        }
    }

    /**
     * Zoho order webhook
     * @returns 
     */
    webHooks = async () => {
        const request = this.req.body
        const invoice = request.hasOwnProperty('invoice')
        let status = invoice ? request.invoice?.status : request.salesorder?.status
        let orderId = request.hasOwnProperty('invoice') ? request.invoice?.salesorder_id : request.salesorder?.salesorder_id
        if (!orderId) {
            this.log.response = 'No order id found'
            await this.log.save()
            return this.res.status(200).send()
        }
        const order = await db.orders.findOne({ where: { order_id: orderId } })
        if (order) {
            const user = await this.getAgentOnStoreOrder(order)
            const storeORderCurrency = order.currency ? JSON.parse(order.currency).rate : 1
            const storedOrderTotal = utils.getOrderDetailTotalAmount(order)
            const difTotla = !invoice ? parseFloat(storedOrderTotal) !== parseFloat(request.salesorder.total) : false
            if (difTotla && user) {
                order.order_details = await this.updateOrder(request, JSON.parse(order.order_details))
                order.amount = request.salesorder.total * storeORderCurrency
                if (order.types !== 'sample' && storeORderCurrency > 1) {
                    await walletController.reverseCommision(request.salesorder.salesorder_id, storedOrderTotal)
                    order.commission = await walletController.createCommision(request.salesorder, user, storeORderCurrency)
                }
            }
            if (!invoice) order.status = status
            if (invoice) order.payments = status
            order.save()
        }
        if (!order && !invoice) await this.syncDirectOrder(request)
        this.log.response = 'Order found and handled'
        await this.log.save()
        return this.res.status(201).send()
    }


    payagent = async () => {
        const request = this.req.body
        const orderId = request.salesorder?.salesorder_id
        const customFields = request?.salesorder?.custom_fields
        const payTagPS = customFields ? customFields.find(dat => dat.label == 'PS')?.value ?? null : null
        try {
            if (!orderId && payTagPS !== "Yes") return this.res.status(400).send("Invalid request")
            const order = await db.orders.findOne({ where: { order_id: orderId } })
            const updated = await this.updateWalletHistoryOnFulfill(orderId, order.payments, order)
            this.log.response = JSON.stringify(updated)
            await this.log.save()
            return this.res.status(200).send(updated)
        } catch (error) {
            throw new Error(error)
        }
    }


    updateWalletHistoryOnFulfill = async (orderId, status, order) => {
        const wallet_history = await db.wallet_history.findOne({
            where: { order_id: orderId, status: 'pending' }
        })
        if (wallet_history && status == 'paid') {
            const attribute = await db.attributes.findOne({ where: { slug: 'sales_person_id' } })
            const sales_person_id = (await db.user_attributes.findOne({ where: { user_id: wallet_history.user_id, attribute_id: attribute.id } })).value
            wallet_history.status = status
            wallet_history.save()
            try {
                const wallet = await this.updateWallet(wallet_history, order)
                return await this.updateSalesPersonZohoProfile(wallet, sales_person_id)
            } catch (error) {
                console.log(error.message)
                throw new Error(error.message)
            }
        } else {
            const mesg = wallet_history ? status : JSON.stringify(wallet_history)
            return { "meg": mesg }
        }
    }

    updateWallet = async (wallet_history, order) => {
        try {
            const wallet = await db.wallets.findOne({ where: { user_id: wallet_history.user_id } })
            wallet.actual_balance += wallet_history?.amount ?? wallet.actual_balance
            !isNaN(wallet.lifetime_sales_value_verified) ? wallet.lifetime_sales_value_verified += utils.getOrderDetailTotalAmount(order) : wallet.lifetime_sales_value_verified = utils.getOrderDetailTotalAmount(order)
            !isNaN(wallet.lifetime_sales_count_verified) ? wallet.lifetime_sales_count_verified += 1 : wallet.lifetime_sales_count_verified = 1
            !isNaN(wallet.lifetime_commision_verified) ? wallet.lifetime_commision_verified += wallet_history?.amount : wallet.lifetime_commision_verified = wallet_history?.amount
            await wallet.save()
            return wallet
        } catch (error) {
            throw new Error(error)
        }

    }

    updateSalesPersonZohoProfile = async (wallet, sales_person_id) => {
        this.req.params = { 'tenant': 'crm', 'endpoint': 'update-salesperson' }
        this.req.query = { 'sales_person_id': sales_person_id }
        this.req.body = { "data": [{ "Revenue_generated": wallet.lifetime_sales_value_verified.toString(), "Earned_Commission": wallet.lifetime_commision_verified.toString() }], return: 1 }
        await this.makeRequest(this.req, this.res)

    }

    updateZohoSalesOrder = async (salesordersId, paymentStatus = '') => {
        this.req.params = { 'tenant': 'zoho', 'endpoint': 'update-orders' }
        this.req.query = { 'order_id': salesordersId }
        this.req.body = { "return": 1, "custom_fields": [{ "label": "Payment Status", "value": paymentStatus }] }
        return await this.makeRequest(this.req, this.res)
    }
    shipOrder = async (order) => {
        const carrierId = order.shipment_details ? JSON.parse(order.shipment_details)?.carrier_id : null
        if (carrierId) {
            this.req.params = { "tenant": "terminalAfrica", "endpoint": 'shipment' }
            this.req.body = JSON.parse(order.shipment_details)
            const { tenant, endpoint } = await getTenantAndEndpoint(this.req.params)
            const requestDetails = await validateRequest({ tenant, endpoint, req: this.req, res: this.res })
            const shipment = await sendRequest(requestDetails)
            return JSON.parse(shipment.data)?.data?.shipment_id
        }
    }

    createAndCalculateCommision = async (orderId) => {

        let savedOrderId = this.requestDetails.req.query.orderId
        let order = await db.orders.findOne({ where: { order_id: orderId } })
        const commission = await walletController.createCommision(order, user)
        order.order_id = zohoOrder.salesorder?.salesorder_id
    }

    updateOrder = async (request, storeORder) => {
        for (let item of request.salesorder.line_items) {
            let found = storeORder?.filter(product => { return product?.item_id == item.product_id })
            let idx = storeORder.findIndex((stord) => { return stord.item_id == item.item_id })
            if (found.length > 0) {
                let { rate, quantity, item_total } = item
                let foundObj = found[0]
                foundObj.rate = rate
                foundObj.total_price = item_total
                foundObj.quantity = quantity
                storeORder[idx] = foundObj
            }
        }

        return JSON.stringify(storeORder)
    }
    mapWebHookPaymentResponse = (status) => {
        // Allowed status "Pending, Success, Fail"
        const items = { "pending": 'Pending', "success": 'Success', "failed": 'Fail', 'Declined': 'Fail' }
        return items[status] ?? 'Pending'
    }

    async syncDirectOrder(order) {
        const custom = order.salesorder.custom_fields
        const orderOnwner = custom.find(dat => dat.label == 'Agent Email')?.value ?? null
        const customerEmail = custom.find(dat => dat.label == 'Customer Email')?.value ?? null
        if (!(orderOnwner ?? customerEmail)) return
        const VendorOrderHelper = require("./vendorOrderHelper.js")
        try {
            const { getUser } = require('../controllers/userController')
            const { getCartDetails } = require('../controllers/cartController')
            const user = flattenObj(await getUser(orderOnwner, null, true) ?? {})
            const userCustomer = flattenObj(await getUser(customerEmail, null, true) ?? {})
            if ((Object.values(user).length + Object.values(userCustomer).length) < 1) return 'User not found'
            const lineItems = order.salesorder.line_items.map(items => {
                return {
                    productId: items.product_id,
                    qty: items.quantity
                }
            })
            const customerName = order.salesorder?.customer_name.split(' ')
            order.salesorder.shipping_address.first_name = customerName[0]
            order.salesorder.shipping_address.last_name = customerName[1]
            const rate = parseFloat(custom.find(dat => dat.label == 'Exchange Rate')?.value ?? "1")
            const symbol = custom.find(dat => dat.label == 'Currency code')?.value ?? 'USD'
            const currency = JSON.stringify({ symbol: symbol, rate: rate })
            const cartDetails = await getCartDetails({ products: JSON.stringify(lineItems) })
            const commission = user ? await walletController.createCommision(order?.salesorder, user, rate) : null
            if (Array.isArray(order.salesorder?.contact_persons_associated) && order.salesorder?.contact_persons_associated.length > 0)
                order.salesorder.shipping_address.email = order.salesorder?.contact_persons_associated[0].contact_person_email ?? null
            const savedOrder = await db.orders.create({
                order_id: order.salesorder.salesorder_id, status: order.salesorder.status, order_ref: order.salesorder.salesorder_number,
                user_id: user?.id ?? userCustomer?.id, agent_id: !user ? null : userCustomer?.id ?? null, order_details: JSON.stringify(cartDetails.items), payments: "admin", commission: commission,
                shipment_details: JSON.stringify({ delivery_address: order.salesorder.shipping_address }), amount: order.salesorder.total * rate, currency: currency
            })
            await (new VendorOrderHelper()).createVendorOrderDetail(savedOrder.id)
            return savedOrder
        } catch (error) {
            console.log(error)
            return
        }
    }


    getAgentOnStoreOrder = async (savedOrder) => {
        const userControler = require('../controllers/userController');
        try {
            let order = savedOrder
            let agentDetails = utils.flattenObj(await userControler.getUser(null, null, true, null, null, order.user_id))
            let isAgent = agentDetails.account_types.split(',').includes('agent') ? agentDetails : null
            if (!isAgent) {
                const customerAgent = order.agent_id ? utils.flattenObj(await userControler.getUser(null, null, true, null, null, order.agent_id)) : null
                const isCustomerAgent = customerAgent ? customerAgent.account_types.split(',').includes('agent') : null
                isAgent = isCustomerAgent ? customerAgent : null
            }
            return isAgent
        } catch (error) {
            console.log(error)
            return false
        }
    }
}

module.exports.WeebHooksHelper = WeebHooksHelper
