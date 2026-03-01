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

    formatCreateZohoContactPayload = async () => {
        const reqPayload = this.requestDetails.req.body
        let isTaken = JSON.parse((await this.validateDuplicateCustomer(reqPayload.email)).data)
        if (isTaken?.contacts?.length > 0) {
            if (reqPayload.return) {
                this.requestDetails.response = { statusCode: 200, data: { message: "This customer email is already linked to a customer. Select from existing customers, or contact admin if not listed.", contact_id: isTaken.contacts[0].contact_id } }
            } else
                throw this.requestDetails.res.status(400).send({ message: "This customer email is already linked to a customer. Select from existing customers, or contact admin if not listed.", zoho_id: isTaken.contacts[0].contact_id })
        }

        let newPayLoad = {
            contact_name: reqPayload.name,
            email: reqPayload.email,
            phone: reqPayload.phone,
            display_name: reqPayload.name
        }

        if (reqPayload.return) newPayLoad.return = 1
        this.requestDetails.payload = newPayLoad
        this.requestDetails.headers.Authorization = await this.getZohoInvetoryToken()
    }


    validateDuplicateCustomer = async (email) => {
        let req = this.requestDetails.req
        let res = this.requestDetails.res
        req.params.tenant = "zoho"
        req.params.endpoint = 'get-customer'
        req.query.email = email
        const { tenant, endpoint } = await getTenantAndEndpoint(this.requestDetails.req.params, this.requestDetails.res)
        const requestDetails = await validateRequest({ tenant, endpoint, req: req, res: res })
        requestDetails.headers = { 'Content-Type': 'application/json', "Authorization": await this.getZohoInvetoryToken() }
        return await sendRequest(requestDetails)

    }

   
}


module.exports.EventstHelper = EventstHelper
