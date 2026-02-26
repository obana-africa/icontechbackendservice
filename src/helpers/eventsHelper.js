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




   
}


module.exports.EventstHelper = EventstHelper
