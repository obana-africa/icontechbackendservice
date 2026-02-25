module.exports = (sequelize, DataTypes) => {

    const T2MobileOrder = sequelize.define("t2mobile_order", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        orderId: {
            type: DataTypes.STRING(100),
            allowNull: false,
            unique: true,
            comment: "T2Mobile Order ID"
        },
        customerId: {
            type: DataTypes.STRING(100),
            allowNull: false,
            comment: "T2Mobile Customer ID"
        },
        customerName: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        customerEmail: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        customerPhone: {
            type: DataTypes.STRING(20),
            allowNull: true
        },
        productId: {
            type: DataTypes.STRING(100),
            allowNull: false,
            comment: "Zoho Product ID (e.g., ZOHO_CRM_STD)"
        },
        tenure: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "Subscription tenure (e.g., 12_MONTHS, 1_MONTH)"
        },
        status: {
            type: DataTypes.ENUM('PENDING', 'PROCESSING', 'FULFILLED', 'FAILED', 'CANCELLED'),
            defaultValue: 'PENDING',
            comment: "Order processing status"
        },
        zohoSalesOrderId: {
            type: DataTypes.STRING(100),
            allowNull: true,
            comment: "Reference to Zoho Sales Order ID"
        },
        activationReference: {
            type: DataTypes.STRING(100),
            allowNull: true,
            comment: "Zoho license/fulfillment activation reference"
        },
        idempotencyKey: {
            type: DataTypes.STRING(255),
            allowNull: false,
            unique: true,
            comment: "Unique idempotency key for duplicate prevention"
        },
        orderDate: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: "Original order date from T2Mobile"
        },
        errorMessage: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "Error details if order failed"
        },
        metadata: {
            type: DataTypes.JSON,
            allowNull: true,
            comment: "Additional order metadata"
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
                fields: ['customerId']
            },
            {
                fields: ['status']
            },
            {
                fields: ['idempotencyKey']
            }
        ]
    })

    return T2MobileOrder

}
