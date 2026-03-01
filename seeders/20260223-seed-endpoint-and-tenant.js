"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if tenant already exists (idempotency)
    const existingTenant = await queryInterface.sequelize.query(
      `SELECT id FROM tenants WHERE slug = 'zoho' LIMIT 1`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    let tenantId;
    if (existingTenant.length > 0) {
      tenantId = existingTenant[0].id;
      console.log(`Tenant 'zoho' already exists with id=${tenantId}, skipping insert`);
    } else {
      // Insert tenant (let PostgreSQL assign the ID)
      const tenantResult = await queryInterface.sequelize.query(
        `INSERT INTO tenants (name, slug, base_url, description, config, status, "createdAt", "updatedAt")
         VALUES ('Zoho', 'zoho', 'www.zohoapis.com/inventory/v1', 'Zoho Inventory Base Url', 
                 $1, 'enable', NOW(), NOW())
         RETURNING id`,
        {
          bind: [JSON.stringify({ organization_id: 914911306, fob_field_id: '4650667000021931197' })],
          type: Sequelize.QueryTypes.SELECT
        }
      );
      tenantId = tenantResult[0].id;
      console.log(`Inserted tenant 'zoho' with auto-generated id=${tenantId}`);
    }

    // Check if endpoints already exist (idempotency)
    const existingEndpoints = await queryInterface.sequelize.query(
      `SELECT slug FROM endpoints WHERE tenant_id = $1 AND slug IN ('get-products', 'get-orders', 'create-orders', 'update-orders', 'customer')`,
      {
        bind: [tenantId],
        type: Sequelize.QueryTypes.SELECT
      }
    );

    // Endpoint data (without IDs - let postgres auto-generate)
    const endpointsToInsert = [
      {
        tenant_id: tenantId,
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
        tenant_id: tenantId,
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
        tenant_id: tenantId,
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
        tenant_id: tenantId,
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
      },
      {
        tenant_id: tenantId,
        name: 'Zoho Create Customer',
        slug: 'customer',
        before_execute: '{  "method":"formatCreateZohoContactPayload",  "shouldWait":1  }',
        after_execute: null,
        route: 'contacts',
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
      }
    ];

    // If some endpoints exist, only insert missing ones
    if (existingEndpoints.length > 0) {
      const existingSlugs = existingEndpoints.map(ep => ep.slug);
      const missingEndpoints = endpointsToInsert.filter(ep => !existingSlugs.includes(ep.slug));
      console.log(`Found ${existingEndpoints.length} existing endpoint(s), inserting ${missingEndpoints.length} missing ones`);
      
      if (missingEndpoints.length > 0) {
        await queryInterface.bulkInsert('endpoints', missingEndpoints);
      }
    } else {
      // All endpoints are new
      console.log(`No endpoints found for tenant_id=${tenantId}, inserting all ${endpointsToInsert.length} endpoints`);
      await queryInterface.bulkInsert('endpoints', endpointsToInsert);
    }
  },

  async down(queryInterface, Sequelize) {
    // Delete endpoints for 'zoho' tenant, then delete the tenant
    const tenant = await queryInterface.sequelize.query(
      `SELECT id FROM tenants WHERE slug = 'zoho' LIMIT 1`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    
    if (tenant.length > 0) {
      const tenantId = tenant[0].id;
      await queryInterface.bulkDelete('endpoints', { tenant_id: tenantId }, {});
    }
    await queryInterface.bulkDelete('tenants', { slug: 'zoho' }, {});
  }
};
