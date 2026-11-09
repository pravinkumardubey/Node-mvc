const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Room = sequelize.define("Room", {
  id: {
    type: DataTypes.STRING,
    allowNull: false,
    primaryKey: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
});

module.exports = Room;
