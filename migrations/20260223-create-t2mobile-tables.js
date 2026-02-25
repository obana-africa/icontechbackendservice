"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('t2mobile_orders', {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      orderId: { type: Sequelize.STRING, allowNull: false, unique: true },
      customerId: { type: Sequelize.STRING, allowNull: true },
      customerName: { type: Sequelize.STRING, allowNull: true },
      customerEmail: { type: Sequelize.STRING, allowNull: true },
      customerPhone: { type: Sequelize.STRING, allowNull: true },
      productId: { type: Sequelize.STRING, allowNull: true },
      tenure: { type: Sequelize.STRING, allowNull: true },
      status: { type: Sequelize.STRING, allowNull: true },
      zohoSalesOrderId: { type: Sequelize.STRING, allowNull: true },
      activationReference: { type: Sequelize.STRING, allowNull: true },
      idempotencyKey: { type: Sequelize.STRING, allowNull: true, unique: true },
      orderDate: { type: Sequelize.DATE, allowNull: true },
      errorMessage: { type: Sequelize.TEXT, allowNull: true },
      metadata: { type: Sequelize.JSON, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: true },
      updatedAt: { type: Sequelize.DATE, allowNull: true }
    });

    await queryInterface.createTable('t2mobile_fulfillments', {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      orderId: { type: Sequelize.STRING, allowNull: false },
      activationReference: { type: Sequelize.STRING, allowNull: true },
      salesOrderId: { type: Sequelize.STRING, allowNull: true },
      status: { type: Sequelize.STRING, allowNull: true },
      expiryDate: { type: Sequelize.DATE, allowNull: true },
      attempts: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
      lastAttemptAt: { type: Sequelize.DATE, allowNull: true },
      lastError: { type: Sequelize.TEXT, allowNull: true },
      zohoResponse: { type: Sequelize.JSON, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: true },
      updatedAt: { type: Sequelize.DATE, allowNull: true }
    });

    await queryInterface.createTable('t2mobile_webhook_logs', {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      eventType: { type: Sequelize.STRING, allowNull: true },
      orderId: { type: Sequelize.STRING, allowNull: true },
      activationReference: { type: Sequelize.STRING, allowNull: true },
      payload: { type: Sequelize.JSON, allowNull: true },
      response: { type: Sequelize.JSON, allowNull: true },
      status: { type: Sequelize.STRING, allowNull: true },
      retries: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
      nextRetryAt: { type: Sequelize.DATE, allowNull: true },
      lastError: { type: Sequelize.TEXT, allowNull: true },
      httpStatusCode: { type: Sequelize.INTEGER, allowNull: true },
      sentAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: true },
      updatedAt: { type: Sequelize.DATE, allowNull: true }
    });
  },

  async down(queryInterface /*, Sequelize*/) {
    await queryInterface.dropTable('t2mobile_webhook_logs');
    await queryInterface.dropTable('t2mobile_fulfillments');
    await queryInterface.dropTable('t2mobile_orders');
  }
};
