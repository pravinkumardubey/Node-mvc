const sequelize = require("./config/database");
const Room = require("./models/Room");

async function test() {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    let room = await Room.findByPk("general");
    if (!room) {
        room = await Room.create({ id: "general", description: "test desc" });
    } else {
        room.description = "test desc updated";
        await room.save();
    }
    console.log("Room updated:", room.description);
    process.exit(0);
}
test().catch(err => {
    console.error("Test error:", err);
    process.exit(1);
});
