/**
 * Handles all socket.io events for a given connection
 * @param {import('socket.io').Server} io - The socket.io server instance
 * @param {import('socket.io').Socket} socket - The connected socket instance
 */

const fs = require("fs");
const path = require("path");

const ChatMessage = require("../models/ChatMessage");
const PrivateMessage = require("../models/PrivateMessage");
const DmNote = require("../models/DmNote");
const User = require("../models/User");
const Room = require("../models/Room");
const { Op } = require("sequelize");

// Track online users per room
const roomUsers = {};

module.exports = (io, socket) => {
    // === CHAT FEATURE ===
    socket.on("joinRoom", async (data) => {
        const { roomId, username, profilePicture } = typeof data === 'string'
            ? { roomId: data, username: 'Anonymous', profilePicture: null }
            : data;

        socket.join(roomId);
        socket.username = username;
        socket.currentRoom = roomId;
        socket.profilePicture = profilePicture;

        // Track user in room
        if (!roomUsers[roomId]) roomUsers[roomId] = {};
        roomUsers[roomId][socket.id] = { username, profilePicture };

        console.log(`Socket ${socket.id} (${username}) joined room ${roomId}`);

        // Notify others in room
        socket.to(roomId).emit("userJoined", { username, timestamp: new Date() });

        // Send updated user list to everyone in the room
        io.to(roomId).emit("roomUsers", Object.values(roomUsers[roomId]));

        // Fetch or create Room to get description
        try {
            let room = await Room.findByPk(roomId);
            if (!room) {
                room = await Room.create({ id: roomId, description: "" });
            }
            socket.emit("roomDescription", room.description);
        } catch (err) {
            console.error("Error fetching room description:", err);
        }

        // Fetch and send chat history
        try {
            const history = await ChatMessage.findAll({
                where: { roomId },
                order: [['timestamp', 'ASC']],
                limit: 50
            });

            // Get unique senders to fetch their latest profile pictures
            const senders = [...new Set(history.map(msg => msg.sender))];
            const users = await User.findAll({
                where: { username: senders },
                attributes: ['username', 'profilePicture']
            });

            const profilePicMap = {};
            users.forEach(u => {
                profilePicMap[u.username.toLowerCase()] = u.profilePicture;
            });

            // Enrich history with latest profile pictures
            const enrichedHistory = history.map(msg => ({
                id: msg.id,
                sender: msg.sender,
                message: msg.message,
                timestamp: msg.timestamp,
                isEdited: msg.isEdited,
                isPinned: msg.isPinned,
                fileUrl: msg.fileUrl,
                fileName: msg.fileName,
                fileType: msg.fileType,
                profilePicture: msg.sender.toLowerCase() in profilePicMap
                    ? profilePicMap[msg.sender.toLowerCase()]
                    : msg.profilePicture
            }));

            socket.emit("chatHistory", enrichedHistory);
        } catch (err) {
            console.error("Error fetching chat history:", err);
        }
    });

    socket.on("leaveRoom", (roomId) => {
        socket.leave(roomId);
        const username = socket.username || 'Anonymous';

        // Remove from tracking
        if (roomUsers[roomId]) {
            delete roomUsers[roomId][socket.id];
            if (Object.keys(roomUsers[roomId]).length === 0) {
                delete roomUsers[roomId];
            }
        }

        socket.to(roomId).emit("userLeft", { username, timestamp: new Date() });

        // Send updated user list
        if (roomUsers[roomId]) {
            io.to(roomId).emit("roomUsers", Object.values(roomUsers[roomId]));
        } else {
            io.to(roomId).emit("roomUsers", []);
        }
    });

    socket.on("chatMessage", async (data) => {
        const { roomId, message, sender, fileUrl, fileName, fileType } = data;
        console.log(`Message to ${roomId} from ${sender}: ${message}`);

        const timestamp = new Date();

        // Look up the sender's actual profile picture from the database
        let profilePicture = null;
        try {
            const senderUser = await User.findOne({
                where: { username: sender },
                attributes: ['profilePicture']
            });
            if (senderUser) {
                profilePicture = senderUser.profilePicture;
            }
        } catch (err) {
            console.error("Error looking up sender profile:", err);
        }

        // Attachment metadata is optional; must be all-or-nothing
        const attachment = (fileUrl && fileName && fileType)
            ? { fileUrl, fileName, fileType }
            : {};

        // Save to Database
        try {
            const saved = await ChatMessage.create({
                roomId,
                sender,
                message,
                profilePicture,
                timestamp,
                ...attachment
            });

            // Broadcast the message to everyone in the room including sender
            io.to(roomId).emit("newMessage", {
                id: saved.id,
                sender,
                message,
                profilePicture,
                timestamp,
                isEdited: false,
                isPinned: false,
                fileUrl: saved.fileUrl,
                fileName: saved.fileName,
                fileType: saved.fileType,
                socketId: socket.id
            });
        } catch (err) {
            console.error("Error saving message:", err);
        }
    });

    // === EDIT MESSAGE ===
    socket.on("editMessage", async ({ messageId, newMessage, roomId }) => {
        const trimmed = (newMessage || '').trim();
        if (!messageId || !trimmed || !roomId) return;

        try {
            const msg = await ChatMessage.findByPk(messageId);

            // Only the original sender can edit their own message
            if (!msg || msg.sender !== socket.username || msg.roomId !== roomId) {
                socket.emit("messageActionError", {
                    action: 'edit',
                    message: !msg ? 'Message not found.' : 'You can only edit your own messages.'
                });
                return;
            }

            msg.message = trimmed;
            msg.isEdited = true;
            await msg.save();

            io.to(roomId).emit("messageEdited", {
                id: msg.id,
                message: msg.message,
                isEdited: true
            });
        } catch (err) {
            console.error("Error editing message:", err);
            socket.emit("messageActionError", { action: 'edit', message: 'Failed to edit message.' });
        }
    });

    // === DELETE MESSAGE ===
    socket.on("deleteMessage", async ({ messageId, roomId }) => {
        if (!messageId || !roomId) return;

        try {
            const msg = await ChatMessage.findByPk(messageId);

            // Only the original sender can delete their own message
            if (!msg || msg.sender !== socket.username || msg.roomId !== roomId) {
                socket.emit("messageActionError", {
                    action: 'delete',
                    message: !msg ? 'Message not found.' : 'You can only delete your own messages.'
                });
                return;
            }

            // Attachment files are only removed when they actually exist on disk
            if (msg.fileUrl && msg.fileUrl.includes('/uploads/chat/') && process.env.STORAGE_TYPE !== 's3') {
                try {
                    const filePath = path.join('uploads', 'chat', path.basename(msg.fileUrl));
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                } catch (fileErr) {
                    console.error("Error deleting attachment file:", fileErr);
                }
            }

            await msg.destroy();

            io.to(roomId).emit("messageDeleted", { id: msg.id });
        } catch (err) {
            console.error("Error deleting message:", err);
            socket.emit("messageActionError", { action: 'delete', message: 'Failed to delete message.' });
        }
    });

    // === PIN MESSAGE ===
    socket.on("togglePinMessage", async ({ messageId, roomId }) => {
        if (!messageId || !roomId) return;
        try {
            const msg = await ChatMessage.findByPk(messageId);
            if (!msg || msg.roomId !== roomId) {
                socket.emit("messageActionError", { action: 'pin', message: 'Message not found.' });
                return;
            }
            msg.isPinned = !msg.isPinned;
            await msg.save();
            io.to(roomId).emit("messagePinned", { id: msg.id, isPinned: msg.isPinned });
        } catch (err) {
            console.error("Error toggling pin message:", err);
            socket.emit("messageActionError", { action: 'pin', message: 'Failed to pin message.' });
        }
    });

    socket.on("getPinnedMessages", async (roomId) => {
        if (!roomId) return;
        try {
            const history = await ChatMessage.findAll({
                where: { roomId, isPinned: true },
                order: [['timestamp', 'DESC']]
            });
            
            // Reusing profile picture logic from chat history if needed, or simply map it
            // For simplicity, just use the stored profilePicture
            const enrichedHistory = history.map(msg => ({
                id: msg.id,
                sender: msg.sender,
                message: msg.message,
                timestamp: msg.timestamp,
                isEdited: msg.isEdited,
                isPinned: msg.isPinned,
                fileUrl: msg.fileUrl,
                fileName: msg.fileName,
                fileType: msg.fileType,
                profilePicture: msg.profilePicture
            }));
            
            socket.emit("pinnedMessagesList", enrichedHistory);
        } catch (err) {
            console.error("Error fetching pinned messages:", err);
        }
    });

    // Typing indicator
    socket.on("typing", (data) => {
        const { roomId, username } = data;
        socket.to(roomId).emit("userTyping", { username });
    });

    socket.on("stopTyping", (data) => {
        const { roomId, username } = data;
        socket.to(roomId).emit("userStopTyping", { username });
    });

    // === ROOM DESCRIPTION ===
    socket.on("updateRoomDescription", async (data) => {
        const { roomId, description } = data;
        if (!roomId) return;
        try {
            let room = await Room.findByPk(roomId);
            if (room) {
                room.description = description;
                await room.save();
            } else {
                room = await Room.create({ id: roomId, description });
            }
            io.to(roomId).emit("roomDescription", room.description);
        } catch (err) {
            console.error("Error updating room description:", err);
        }
    });

    // === LIVE NOTIFICATIONS FEATURE ===
    socket.on("registerUser", (userId) => {
        socket.join(`user_${userId}`);
        console.log(`Socket ${socket.id} registered for user notifications: user_${userId}`);
    });

    // === ONE TO ONE CHAT FEATURE ===
    socket.on("getRecentConversations", async (username) => {
        if (!username) return;
        try {
            // Find all unique conversations for this user
            const messages = await PrivateMessage.findAll({
                where: {
                    [Op.or]: [{ sender: username }, { receiver: username }]
                },
                order: [['timestamp', 'DESC']],
                attributes: ['sender', 'receiver', 'message', 'timestamp', 'profilePicture', 'isRead']
            });
            
            const recent = {};
            messages.forEach(msg => {
                const otherUser = msg.sender === username ? msg.receiver : msg.sender;
                if (!recent[otherUser]) {
                    recent[otherUser] = {
                        username: otherUser,
                        lastMessage: msg.message,
                        lastTimestamp: msg.timestamp,
                        profilePicture: msg.sender === otherUser ? msg.profilePicture : null, // best effort
                        unread: (msg.receiver === username && !msg.isRead) ? 1 : 0
                    };
                } else {
                    if (msg.receiver === username && !msg.isRead) {
                        recent[otherUser].unread++;
                    }
                    if (!recent[otherUser].profilePicture && msg.sender === otherUser && msg.profilePicture) {
                        recent[otherUser].profilePicture = msg.profilePicture;
                    }
                }
            });
            
            socket.emit("recentConversations", Object.values(recent));
        } catch (err) {
            console.error("Error fetching recent conversations:", err);
        }
    });

    socket.on("joinPrivateChat", async (data) => {
        const { sender, receiver } = data;
        const privateRoomId = [sender, receiver].sort().join("_");
        socket.join(privateRoomId);
        
        try {
            const history = await PrivateMessage.findAll({
                where: {
                    [Op.or]: [
                        { sender, receiver },
                        { sender: receiver, receiver: sender }
                    ]
                },
                order: [['timestamp', 'ASC']],
                limit: 50
            });
            
            // Send history to user joining
            socket.emit("privateChatHistory", history);
        } catch (err) {
            console.error("Error fetching private chat history:", err);
        }
    });

    socket.on("privateMessage", async (data) => {
        const { sender, receiver, message, fileUrl, fileName, fileType } = data;
        const privateRoomId = [sender, receiver].sort().join("_");
        
        let profilePicture = null;
        try {
            const senderUser = await User.findOne({
                where: { username: sender },
                attributes: ['profilePicture']
            });
            if (senderUser) profilePicture = senderUser.profilePicture;
        } catch (err) {}

        const attachment = (fileUrl && fileName && fileType) ? { fileUrl, fileName, fileType } : {};

        try {
            const saved = await PrivateMessage.create({
                sender,
                receiver,
                message,
                profilePicture,
                ...attachment
            });

            // Emit to the private room
            io.to(privateRoomId).emit("newPrivateMessage", {
                id: saved.id,
                sender: saved.sender,
                receiver: saved.receiver,
                message: saved.message,
                profilePicture: saved.profilePicture,
                timestamp: saved.timestamp,
                isEdited: false,
                isPinned: false,
                isRead: false,
                fileUrl: saved.fileUrl,
                fileName: saved.fileName,
                fileType: saved.fileType,
            });

            // Also send notification to the receiver's global notification channel if they are online
            socket.to(`user_${receiver}`).emit("privateMessageNotification", {
                sender,
                message: saved.message
            });
        } catch (err) {
            console.error("Error saving private message:", err);
        }
    });

    socket.on("editPrivateMessage", async ({ messageId, newMessage, sender, receiver }) => {
        const trimmed = (newMessage || '').trim();
        if (!messageId || !trimmed) return;
        const privateRoomId = [sender, receiver].sort().join("_");

        try {
            const msg = await PrivateMessage.findByPk(messageId);
            if (!msg || msg.sender !== sender) {
                socket.emit("messageActionError", { action: 'edit', message: 'Not allowed or not found' });
                return;
            }
            msg.message = trimmed;
            msg.isEdited = true;
            await msg.save();
            io.to(privateRoomId).emit("privateMessageEdited", { id: msg.id, message: msg.message, isEdited: true });
        } catch (err) {
            console.error("Error editing private message:", err);
        }
    });

    socket.on("deletePrivateMessage", async ({ messageId, sender, receiver }) => {
        if (!messageId) return;
        const privateRoomId = [sender, receiver].sort().join("_");

        try {
            const msg = await PrivateMessage.findByPk(messageId);
            if (!msg || msg.sender !== sender) return;

            if (msg.fileUrl && msg.fileUrl.includes('/uploads/chat/') && process.env.STORAGE_TYPE !== 's3') {
                try {
                    const filePath = path.join('uploads', 'chat', path.basename(msg.fileUrl));
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                } catch (fileErr) {}
            }
            await msg.destroy();
            io.to(privateRoomId).emit("privateMessageDeleted", { id: msg.id });
        } catch (err) {
            console.error("Error deleting private message:", err);
        }
    });

    socket.on("privateTyping", ({ sender, receiver }) => {
        const privateRoomId = [sender, receiver].sort().join("_");
        socket.to(privateRoomId).emit("userPrivateTyping", { username: sender });
    });

    socket.on("privateStopTyping", ({ sender, receiver }) => {
        const privateRoomId = [sender, receiver].sort().join("_");
        socket.to(privateRoomId).emit("userPrivateStopTyping", { username: sender });
    });

    // === PIN PRIVATE MESSAGE ===
    socket.on("togglePinPrivateMessage", async ({ messageId, sender, receiver }) => {
        if (!messageId) return;
        const privateRoomId = [sender, receiver].sort().join("_");
        try {
            const msg = await PrivateMessage.findByPk(messageId);
            if (!msg) {
                socket.emit("messageActionError", { action: 'pin', message: 'Message not found.' });
                return;
            }
            // Both participants can pin
            const participants = [msg.sender, msg.receiver];
            if (!participants.includes(sender)) {
                socket.emit("messageActionError", { action: 'pin', message: 'Not allowed.' });
                return;
            }
            msg.isPinned = !msg.isPinned;
            await msg.save();
            io.to(privateRoomId).emit("privateMessagePinned", { id: msg.id, isPinned: msg.isPinned });
        } catch (err) {
            console.error("Error toggling private pin:", err);
            socket.emit("messageActionError", { action: 'pin', message: 'Failed to pin message.' });
        }
    });

    socket.on("getPinnedPrivateMessages", async ({ sender, receiver }) => {
        if (!sender || !receiver) return;
        try {
            const pinned = await PrivateMessage.findAll({
                where: {
                    isPinned: true,
                    [Op.or]: [
                        { sender, receiver },
                        { sender: receiver, receiver: sender }
                    ]
                },
                order: [['timestamp', 'DESC']]
            });
            socket.emit("pinnedPrivateMessagesList", pinned);
        } catch (err) {
            console.error("Error fetching pinned private messages:", err);
        }
    });

    // === DM NOTES (like room description) ===
    socket.on("getDmNote", async ({ sender, receiver }) => {
        if (!sender || !receiver) return;
        const conversationId = [sender, receiver].sort().join("_");
        try {
            const record = await DmNote.findOne({ where: { conversationId } });
            socket.emit("dmNote", record ? record.note : "");
        } catch (err) {
            console.error("Error fetching DM note:", err);
            socket.emit("dmNote", "");
        }
    });

    socket.on("updateDmNote", async ({ sender, receiver, note }) => {
        if (!sender || !receiver) return;
        const conversationId = [sender, receiver].sort().join("_");
        const privateRoomId = conversationId;
        try {
            let record = await DmNote.findOne({ where: { conversationId } });
            if (record) {
                record.note = note || "";
                await record.save();
            } else {
                record = await DmNote.create({ conversationId, note: note || "" });
            }
            // Broadcast updated note to both participants
            io.to(privateRoomId).emit("dmNote", record.note);
        } catch (err) {
            console.error("Error updating DM note:", err);
        }
    });

    // === COLLABORATIVE TOOLS ===
    socket.on("collaborationAction", (data) => {
        const { documentId, action } = data;
        socket.to(`doc_${documentId}`).emit("collaboratorUpdate", action);
    });

    socket.on("disconnect", () => {
        console.log(`Client disconnected: ${socket.id}`);

        // Clean up user from all rooms they were in
        for (const roomId in roomUsers) {
            if (roomUsers[roomId][socket.id]) {
                const username = roomUsers[roomId][socket.id].username;
                delete roomUsers[roomId][socket.id];

                socket.to(roomId).emit("userLeft", { username, timestamp: new Date() });

                if (Object.keys(roomUsers[roomId]).length === 0) {
                    delete roomUsers[roomId];
                } else {
                    io.to(roomId).emit("roomUsers", Object.values(roomUsers[roomId]));
                }
            }
        }
    });
};
