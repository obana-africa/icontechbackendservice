const dbConfig = require('../config/dbConfig.js');
const { createClient } = require('redis')
const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize(
    dbConfig.DB,
    dbConfig.USER,
    dbConfig.PASSWORD, {
    host: dbConfig.HOST,
    port: dbConfig.PORT,
    dialect: dbConfig.dialect,
    operatorsAliases: 0,
    logging: false,
    pool: {
        max: dbConfig.pool.max,
        min: dbConfig.pool.min,
        acquire: dbConfig.pool.acquire,
        idle: dbConfig.pool.idle

    }
}
)
const redis = createClient(dbConfig.REDIS_CONN);
redis.on('error', err => console.log('Redis Client Error', err));
redis.connect();
redis.select(dbConfig.REDIS_DB)


const Cache = require('./cache.js')


sequelize.authenticate()
    .then(() => {
        console.log('connected..')
    })
    .catch(err => {
        console.log('Error' + err)
    })

const db = {}

db.Sequelize = Sequelize
db.sequelize = sequelize

db.tenants = require('./tenantModel.js')(sequelize, DataTypes)
db.endpoints = require('./endpointModel.js')(sequelize, DataTypes)
db.requests = require('./requestModel.js')(sequelize, DataTypes)



db.t2mobile_orders = require('./t2mobileOrderModel.js')(sequelize, DataTypes)
db.t2mobile_fulfillments = require('./t2mobileFulfillmentModel.js')(sequelize, DataTypes)
db.t2mobile_webhook_logs = require('./t2mobileWebhookLogModel.js')(sequelize, DataTypes)

db.cache = new Cache(redis)

db.sequelize.sync({ force: false })
    .then(() => {
        console.log('yes re-sync done!')
    })



db.tenants.hasMany(db.endpoints, {
    foreignKey: 'tenant_id',
    as: 'endpoints'
})

db.endpoints.belongsTo(db.tenants, {
    foreignKey: 'tenant_id',
    as: 'tenant'
})


module.exports = db