module.exports = (sequelize, DataTypes) => {

    const T2MobileWebhookLog = sequelize.define("t2mobile_webhook_log", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        eventType: {
            type: DataTypes.ENUM(
                'ORDER_FULFILLED',
                'ORDER_FAILED',
                'SUBSCRIPTION_RENEWED',
                'EXPIRY_REMINDER',
                'OTHER'
            ),
            allowNull: false,
            comment: "Type of webhook event"
        },
        orderId: {
            type: DataTypes.STRING(100),
            allowNull: true,
            comment: "Related T2Mobile Order ID (nullable for non-order events)"
        },
        activationReference: {
            type: DataTypes.STRING(100),
            allowNull: true,
            comment: "Related activation reference"
        },
        payload: {
            type: DataTypes.JSON,
            allowNull: false,
            comment: "Webhook payload sent to T2Mobile"
        },
        response: {
            type: DataTypes.JSON,
            allowNull: true,
            comment: "Response received from T2Mobile"
        },
        status: {
            type: DataTypes.ENUM('PENDING', 'SENT', 'FAILED', 'RETRYING'),
            defaultValue: 'PENDING',
            comment: "Current delivery status"
        },
        retries: {
            type: DataTypes.INTEGER(3),
            defaultValue: 0,
            comment: "Number of delivery retries"
        },
        nextRetryAt: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: "Scheduled time for next retry"
        },
        lastError: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "Error message from last failed attempt"
        },
        httpStatusCode: {
            type: DataTypes.INTEGER(3),
            allowNull: true,
            comment: "HTTP status code from T2Mobile response"
        },
        sentAt: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: "Timestamp when webhook was sent"
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
                fields: ['eventType']
            },
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
                fields: ['nextRetryAt']
            }
        ]
    })

    return T2MobileWebhookLog

}
