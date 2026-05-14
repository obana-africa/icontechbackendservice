"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('revenue_settlements', {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      orderId: { type: Sequelize.STRING, allowNull: false },
      partnerId: { type: Sequelize.STRING, allowNull: false },
      grossAmount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      currency: { type: Sequelize.STRING(3), defaultValue: 'NGN' },
      revenueShare: { type: Sequelize.DECIMAL(5, 4), allowNull: false },
      partnerAmount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      icontechAmount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      settlementStatus: { type: Sequelize.ENUM('PENDING', 'SETTLED', 'FAILED'), defaultValue: 'PENDING' },
      settlementDate: { type: Sequelize.DATE, allowNull: true },
      metadata: { type: Sequelize.JSON, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: true },
      updatedAt: { type: Sequelize.DATE, allowNull: true }
    });
  },

  async down(queryInterface /*, Sequelize*/) {
    await queryInterface.dropTable('revenue_settlements');
  }
};