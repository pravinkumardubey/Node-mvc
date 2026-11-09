const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Product = sequelize.define(
    "Product",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: {
            type: DataTypes.STRING,
        },
        description: {
            type: DataTypes.TEXT,
        },
        price: {
            type: DataTypes.DECIMAL(10, 2),
        },
        stock: {
            type: DataTypes.INTEGER,
        },
        image: {
            type: DataTypes.STRING,
        },
    },
    {
        tableName: "products",
        timestamps: true,
    }
);

module.exports = Product;