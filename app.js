const express = require("express");
const http = require("http");
require("dotenv").config();
const socketConfig = require("./config/socket");

const sequelize = require("./config/database");
const User = require("./models/User");
const ChatMessage = require("./models/ChatMessage");
const Room = require("./models/Room");
const PrivateMessage = require("./models/PrivateMessage");
const DmNote = require("./models/DmNote");

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
socketConfig.init(server);

app.use(express.json());
const productRoutes = require("./routes/product.routes");
const authRoutes = require("./routes/auth.routes");
const emailRoutes = require("./routes/email.route");
const userRoutes = require("./routes/user.routes");
const uploadRoutes = require("./routes/upload.routes");

app.use("/products", productRoutes);
app.use("/auth", authRoutes);
app.use("/email", emailRoutes);
app.use("/users", userRoutes);
app.use("/uploads/api", uploadRoutes);

// Serve static files from the uploads directory
app.use("/uploads", express.static("uploads"));

// Serve static files for Socket.io test client
app.use(express.static("public"));

sequelize.authenticate()
    .then(async () => {
        console.log("Database Connected");
        // Sync only new models with alter, existing stable models with plain sync
        // This prevents Sequelize from re-adding duplicate unique indexes on the Users table
        await User.sync();
        await ChatMessage.sync();
        await Room.sync();
        await PrivateMessage.sync(); // New model — create if not exists
        await DmNote.sync();         // Per-conversation notes
        console.log("Database synced");
    })
    .catch((err) => console.log(err));
/**
 * CRON Setup
 * */
require("./cron/cleanup");
const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});


// app.listen(2000, () => {
//     console.log("Server running on port 2000");
// });