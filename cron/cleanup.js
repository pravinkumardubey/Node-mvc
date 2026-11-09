const cron = require("node-cron");
const User = require("../models/User");

cron.schedule("0 12 * * *", async () => {
    console.log("Starting cleanup...");

    try {
        await User.destroy({
            where: {
                status: false,
                role: 'user'
            }
        });

        console.log("Cleanup completed");
    } catch (error) {
        console.error(error);
    }
    },
        {
            timezone: "Asia/Kolkata"
        }
    );