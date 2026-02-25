module.exports = (sequelize, DataTypes) => {

    const T2MobileFulfillment = sequelize.define("t2mobile_fulfillment", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        orderId: {
            type: DataTypes.STRING(100),
            allowNull: false,
            comment: "T2Mobile Order ID (foreign key reference)"
        },
        activationReference: {
            type: DataTypes.STRING(100),
            allowNull: true,
            comment: "Zoho fulfillment/license activation ID"
        },
        salesOrderId: {
            type: DataTypes.STRING(100),
            allowNull: true,
            comment: "Zoho Sales Order ID"
        },
        status: {
            type: DataTypes.ENUM('PENDING', 'PROVISIONING', 'ACTIVE', 'FAILED', 'EXPIRED', 'REVOKED'),
            defaultValue: 'PENDING',
            comment: "Fulfillment status"
        },
        expiryDate: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: "License/subscription expiry date"
        },
        attempts: {
            type: DataTypes.INTEGER(3),
            defaultValue: 0,
            comment: "Number of provisioning attempts"
        },
        lastAttemptAt: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: "Timestamp of last provisioning attempt"
        },
        lastError: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "Error message from last failed attempt"
        },
        zohoResponse: {
            type: DataTypes.JSON,
            allowNull: true,
            comment: "Full response from Zoho API"
        },
        createdAt: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        updatedAt: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        indexes: [
            {
                fields: ['orderId']
            },
            {
                fields: ['status']
            },
            {
                fields: ['activationReference']
            },
            {
                fields: ['expiryDate']
            }
        ]
    })

    return T2MobileFulfillment

}
