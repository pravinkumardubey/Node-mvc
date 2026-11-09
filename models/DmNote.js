const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Stores per-conversation notes (like room description but for DMs)
// conversationId is always sorted: "userA_userB" (alphabetically)
const DmNote = sequelize.define("DmNote", {
  conversationId: {
    type: DataTypes.STRING(512),
    allowNull: false,
    unique: true,
  },
  note: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: "",
  },
});

module.exports = DmNote;
