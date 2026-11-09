const cron = require("node-cron");

cron.schedule("* * * * *", () => {
    console.log("Cron running every minute At "+ new Date().toTimeString());
});

cron.schedule("*/5 * * * *", () => {
    console.log("Every 5 minutes");
});