module.exports = (sequelize, DataTypes) => {

    const User = sequelize.define("user", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: true
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        phone: {
            type: DataTypes.STRING,
            allowNull: true
        },
        contact_id: {
            type: DataTypes.STRING,
            allowNull: true
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
    })

    return User

}
