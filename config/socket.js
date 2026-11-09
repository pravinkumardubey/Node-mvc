const { Server } = require("socket.io");
const socketHandler = require("../sockets/socketHandler");

let io;

module.exports = {
    init: (httpServer) => {
        io = new Server(httpServer, {
            cors: {
                origin: "*", // Adjust this in production for security
                methods: ["GET", "POST"]
            }
        });

        // Initialize socket handlers
        io.on("connection", (socket) => {
            console.log(`New client connected: ${socket.id}`);
            socketHandler(io, socket);
        });

        return io;
    },
    getIO: () => {
        if (!io) {
            throw new Error("Socket.io not initialized!");
        }
        return io;
    }
};
