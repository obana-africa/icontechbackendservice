"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('partners', {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      partnerId: { type: Sequelize.STRING, allowNull: false, unique: true },
      companyName: { type: Sequelize.STRING, allowNull: false },
      tier: { type: Sequelize.ENUM('GOLD', 'SILVER', 'BRONZE'), defaultValue: 'BRONZE' },
      revenueShare: { type: Sequelize.DECIMAL(5, 4), defaultValue: 0.30 },
      status: { type: Sequelize.ENUM('ACTIVE', 'INACTIVE'), defaultValue: 'ACTIVE' },
      apiBaseUrl: { type: Sequelize.STRING, allowNull: true },
      apiKey: { type: Sequelize.STRING, allowNull: true }, // Encrypted
      webhookSecret: { type: Sequelize.STRING, allowNull: true }, // Encrypted
      contactEmail: { type: Sequelize.STRING, allowNull: true },
      contactPhone: { type: Sequelize.STRING, allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      metadata: { type: Sequelize.JSON, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: true },
      updatedAt: { type: Sequelize.DATE, allowNull: true }
    });
  },

  async down(queryInterface /*, Sequelize*/) {
    await queryInterface.dropTable('partners');
  }
};