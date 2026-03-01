"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Insert tenant
    await queryInterface.bulkInsert('tenants', [
      {
        id: 1,
        name: 'Zoho',
        slug: 'zoho',
        base_url: 'www.zohoapis.com/inventory/v1',
        description: 'Zoho Inventory Base Url',
        registry: null,
        config: JSON.stringify({ organization_id: 914911306, fob_field_id: '4650667000021931197' }),
        status: 'enable',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], { ignoreDuplicates: true });

    // Insert endpoints
    await queryInterface.bulkInsert('endpoints', [
      {
        id: 448,
        tenant_id: 1,
        name: 'Zoho_product',
        slug: 'get-products',
        before_execute: '{  "method":"getCategoryTree",  "shouldWait":1  }',
        after_execute: null,
        route: 'items',
        verb: 'get',
        type: 'rest',
        parameters: '{  "brand":{"source":"query.brand"},  "name_contains":{"source":"query.name"},  "rate_greater_equals":{"source":"query.rate_greater_equals"},  "rate_less_equals":{"source":"query.rate_less_equals"},  "available_greater_equals":{"source":"query.available_greater_equals"},  "organization_id":{"source":"tenantConfig.organization_id"},  "page" : {"source":"query.page", "default":1},  "per_page" : {"source":"query.per_page", "default":20},  "sort_order":{"source":"query.sort_order", "default":"D"},  "sort_column":{"source":"query.sort_column", "default":"created_time"},  "cf_b2b":{"source":"query.cf_b2b", "default":"YES"},  "cf_fob":{"source":"query.fob"},  "cf_slug":{"source":"query.cf_slug"},  "item_id":{"source":"query.item_id"},  "stock_on_hand":{"source":"query.stock_on_hand"},  "parent_id":{"source":"query.parent_id"},  "category_id":{"source":"query.category_id"},  "cf_color":{"source":"cf_color"},  "cf_vendor_name":{"source":"query.vendor_name", "default":""},  "cf_sample_available":{"source":"query.cf_sample_available"}  }',
        payload: null,
        headers: '{ "Content-Type": "application/json",  "Authorization":"123" }',
        require_authentication: 'false',
        response: null,
        status: null,
        scope: null,
        log: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 35,
        tenant_id: 1,
        name: 'Zoho Orders',
        slug: 'get-orders',
        before_execute: '{  "method":"getZohoSalesOrderToken",  "shouldWait":1,  "assignTo":"headers.Authorization"    }',
        after_execute: null,
        route: 'salesorders',
        verb: 'get',
        type: 'rest',
        parameters: '{    "organization_id":{"source":"tenantConfig.organization_id"},  "customer_id":{"source":"query.customer_id"},  "page" : {"source":"query.page", "default":1},    "per_page" : {"source":"query.per_page", "default":20},     "sort_order":{"source":"query.sort_order", "default":"D"},     "sort_column":{"source":"query.sort_column", "default":"created_time"}  }',
        payload: null,
        headers: '{ "Content-Type": "application/json",  "Authorization":"123" }',
        require_authentication: null,
        response: null,
        status: null,
        scope: null,
        log: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 36,
        tenant_id: 1,
        name: 'Zoho Create Order',
        slug: 'create-orders',
        before_execute: '{  "method":"getZohoSalesOrderToken",  "shouldWait":1,  "assignTo":"headers.Authorization"    }',
        after_execute: null,
        route: 'salesorders',
        verb: 'post',
        type: 'rest',
        parameters: '{    "organization_id":{"source":"tenantConfig.organization_id"}  }',
        payload: null,
        headers: '{ "Content-Type": "application/json",  "Authorization":"123" }',
        require_authentication: null,
        response: null,
        status: null,
        scope: null,
        log: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 49,
        tenant_id: 1,
        name: 'Update Zoho Orders',
        slug: 'update-orders',
        before_execute: '{  "method":"getZohoSalesOrderToken",  "shouldWait":1,  "assignTo":"headers.Authorization"    }',
        after_execute: null,
        route: 'salesorders/#{"source":"query.order_id"}#',
        verb: 'put',
        type: 'rest',
        parameters: '{    "organization_id":{"source":"tenantConfig.organization_id"}  }',
        payload: null,
        headers: '{ "Content-Type": "application/json",  "Authorization":"123" }',
        require_authentication: null,
        response: null,
        status: null,
        scope: null,
        log: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], { ignoreDuplicates: true });
  },

  async down(queryInterface /*, Sequelize*/) {
    await queryInterface.bulkDelete('endpoints', { id: [448,35,36,49] }, {});
    await queryInterface.bulkDelete('tenants', { id: [1] }, {});
  }
};
