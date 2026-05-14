module.exports = (sequelize, DataTypes) => {

    const RevenueSettlement = sequelize.define("revenue_settlement", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        orderId: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        partnerId: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        grossAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        currency: {
            type: DataTypes.STRING(3),
            defaultValue: 'NGN'
        },
        revenueShare: {
            type: DataTypes.DECIMAL(5, 4),
            allowNull: false,
            comment: "Partner's revenue share percentage"
        },
        partnerAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        icontechAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        settlementStatus: {
            type: DataTypes.ENUM('PENDING', 'SETTLED', 'FAILED'),
            defaultValue: 'PENDING'
        },
        settlementDate: {
            type: DataTypes.DATE,
            allowNull: true
        },
        metadata: {
            type: DataTypes.JSON,
            allowNull: true
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
                fields: ['partnerId']
            },
            {
                fields: ['settlementStatus']
            }
        ]
    });

    return RevenueSettlement;
};