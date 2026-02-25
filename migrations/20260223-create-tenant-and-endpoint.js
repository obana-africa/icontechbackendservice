"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tenants', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      name: { type: Sequelize.STRING, allowNull: false },
      slug: { type: Sequelize.STRING, allowNull: false },
      base_url: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      registry: { type: Sequelize.TEXT, allowNull: true },
      config: { type: Sequelize.TEXT, allowNull: true },
      status: { type: Sequelize.STRING, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: true },
      updatedAt: { type: Sequelize.DATE, allowNull: true }
    });

    await queryInterface.createTable('endpoints', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      tenant_id: { type: Sequelize.INTEGER, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      slug: { type: Sequelize.STRING, allowNull: false },
      before_execute: { type: Sequelize.TEXT, allowNull: true },
      after_execute: { type: Sequelize.TEXT, allowNull: true },
      route: { type: Sequelize.TEXT, allowNull: false },
      verb: { type: Sequelize.STRING, allowNull: false },
      type: { type: Sequelize.STRING, allowNull: false },
      parameters: { type: Sequelize.TEXT, allowNull: true },
      payload: { type: Sequelize.TEXT, allowNull: true },
      headers: { type: Sequelize.TEXT, allowNull: true },
      require_authentication: { type: Sequelize.STRING, allowNull: true, defaultValue: '0' },
      response: { type: Sequelize.TEXT, allowNull: true },
      status: { type: Sequelize.STRING, allowNull: true },
      scope: { type: Sequelize.STRING, allowNull: true },
      log: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
      createdAt: { type: Sequelize.DATE, allowNull: true },
      updatedAt: { type: Sequelize.DATE, allowNull: true }
    });
  },

  async down(queryInterface /*, Sequelize*/) {
    await queryInterface.dropTable('endpoints');
    await queryInterface.dropTable('tenants');
  }
};
