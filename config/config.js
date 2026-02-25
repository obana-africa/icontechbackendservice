require('dotenv').config()

module.exports = {
  development: {
    host: process.env.DB_HOST,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    dialect: process.env.DB_DIALECT ?? 'postgres',
    migrationStorageTableName: "migrations",
    port: process.env.DB_PORT
  },
  test: {
    host: process.env.DB_HOST,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    dialect: process.env.DB_DIALECT,
    migrationStorageTableName: "migrations",
    port: process.env.DB_PORT,
  },
  production: {
    host: process.env.DB_HOST,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    dialect: process.env.DB_DIALECT ?? 'postgres',
    migrationStorageTableName: "migrations",
    port: 3306
  },
  use_env_variable: process.env.ENV
}
